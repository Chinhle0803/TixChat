const DEFAULT_PROVINCE = 'Thành phố Hồ Chí Minh'

const toComparable = (value = '') => String(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd')
  .replace(/Đ/g, 'D')
  .toLowerCase()
  .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const toDisplayCase = (value = '') => String(value)
  .trim()
  .replace(/\s+/g, ' ')
  .split(' ')
  .filter(Boolean)
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
  .join(' ')

const stripLeadingLabel = (value = '', patterns = []) => {
  let next = String(value || '').trim()
  patterns.forEach((pattern) => {
    next = next.replace(pattern, '').trim()
  })
  return next.replace(/\s+/g, ' ')
}

const isCountrySegment = (value = '') => {
  const comparable = toComparable(value)
  return comparable === 'viet nam' || comparable === 'vietnam'
}

const isProvinceLikeSegment = (value = '') => {
  const comparable = toComparable(value)
  return (
    comparable.includes('ho chi minh') ||
    comparable.includes('sai gon') ||
    comparable === 'hcm' ||
    comparable === 'tphcm' ||
    comparable === 'tp hcm' ||
    comparable.includes('ha noi') ||
    comparable.startsWith('thanh pho ') ||
    comparable.startsWith('tp ') ||
    comparable.startsWith('tinh ')
  )
}

const isDistrictLikeSegment = (value = '') => {
  const comparable = toComparable(value)
  return (
    comparable.startsWith('quan ') ||
    /^q\.?\s*\d{1,2}$/.test(comparable) ||
    comparable.startsWith('huyen ') ||
    comparable.startsWith('thi xa ') ||
    comparable.includes('thu duc')
  )
}

const canonicalizeProvince = (value = '') => {
  const raw = String(value || '').trim()
  if (!raw) return ''

  const comparable = toComparable(raw)
  if (!comparable) return ''

  if (
    comparable.includes('ho chi minh') ||
    comparable === 'hcm' ||
    comparable === 'tphcm' ||
    comparable === 'tp hcm' ||
    comparable.includes('sai gon')
  ) {
    return DEFAULT_PROVINCE
  }

  if (comparable === 'ha noi' || comparable.includes('thanh pho ha noi')) {
    return 'Hà Nội'
  }

  const cleaned = stripLeadingLabel(raw, [/^tp\.?\s*/i, /^thanh pho\s+/i, /^tinh\s+/i])
  if (!cleaned) return ''

  if (comparable.startsWith('thanh pho ') || comparable.startsWith('tp ')) {
    return `Thành phố ${toDisplayCase(cleaned)}`
  }
  if (comparable.startsWith('tinh ')) {
    return `Tỉnh ${toDisplayCase(cleaned)}`
  }

  return toDisplayCase(cleaned)
}

const canonicalizeDistrict = (value = '') => {
  const raw = String(value || '').trim()
  if (!raw) return ''

  const comparable = toComparable(raw)
  if (!comparable) return ''

  const districtNumber = comparable.match(/^(q|quan)\s*(\d{1,2})$/)
  if (districtNumber) return `Quận ${districtNumber[2]}`

  if (comparable.includes('thu duc')) {
    return 'Thành phố Thủ Đức'
  }

  if (comparable.startsWith('quan ')) {
    return `Quận ${toDisplayCase(stripLeadingLabel(raw, [/^quan\s+/i]))}`
  }
  if (comparable.startsWith('huyen ')) {
    return `Huyện ${toDisplayCase(stripLeadingLabel(raw, [/^huyen\s+/i]))}`
  }
  if (comparable.startsWith('thi xa ')) {
    return `Thị xã ${toDisplayCase(stripLeadingLabel(raw, [/^thi xa\s+/i]))}`
  }
  if (comparable.startsWith('thanh pho ') || comparable.startsWith('tp ')) {
    return `Thành phố ${toDisplayCase(stripLeadingLabel(raw, [/^tp\.?\s*/i, /^thanh pho\s+/i]))}`
  }

  return toDisplayCase(raw)
}

const extractRegionFromAddress = (address = '') => {
  const rawAddress = String(address || '').trim()
  if (!rawAddress) {
    return { province: '', district: '' }
  }

  const segments = rawAddress
    .split(',')
    .map((segment) => segment.trim())
    .filter(Boolean)

  const regionSegments = segments.filter((segment) => !isCountrySegment(segment))
  const provinceSegment = [...regionSegments]
    .reverse()
    .find(isProvinceLikeSegment) || (regionSegments.length > 1 ? regionSegments[regionSegments.length - 1] : '')
  const districtSegment = [...regionSegments]
    .reverse()
    .find(isDistrictLikeSegment) || ''

  return {
    province: canonicalizeProvince(provinceSegment),
    district: canonicalizeDistrict(districtSegment),
  }
}

export const normalizeRegionContext = ({ province = '', district = '', fallbackProvince = '' } = {}) => {
  const normalizedProvince = canonicalizeProvince(province) || canonicalizeProvince(fallbackProvince)
  const normalizedDistrict = canonicalizeDistrict(district)
  return {
    province: normalizedProvince,
    district: normalizedDistrict,
  }
}

export const normalizePostLocation = (location = {}) => {
  if (!location || typeof location !== 'object') return null
  const address = String(location.address || '').trim()
  const derived = extractRegionFromAddress(address)
  const province = canonicalizeProvince(location.province || derived.province || location.fallbackProvince)
  const district = canonicalizeDistrict(location.district || derived.district || location.fallbackDistrict)
  const publicLocation = { ...location }
  delete publicLocation.fallbackProvince
  delete publicLocation.fallbackDistrict
  return {
    ...publicLocation,
    address,
    province,
    district,
  }
}

export const rankPostByRegion = (post, context = {}) => {
  const postProvince = canonicalizeProvince(post?.location?.province || '')
  const postDistrict = canonicalizeDistrict(post?.location?.district || '')
  const userProvince = canonicalizeProvince(context?.province || '')
  const userDistrict = canonicalizeDistrict(context?.district || '')

  if (userDistrict && userProvince && postDistrict === userDistrict && postProvince === userProvince) {
    return 0
  }
  if (userProvince && postProvince === userProvince) {
    return 1
  }
  return 2
}

export const comparePostsByRegion = (a, b, context = {}) => {
  const rankA = rankPostByRegion(a, context)
  const rankB = rankPostByRegion(b, context)
  if (rankA !== rankB) return rankA - rankB

  const createdAtA = Date.parse(a?.createdAt || '')
  const createdAtB = Date.parse(b?.createdAt || '')
  const hasCreatedAtA = Number.isFinite(createdAtA)
  const hasCreatedAtB = Number.isFinite(createdAtB)

  if (hasCreatedAtA && hasCreatedAtB && createdAtA !== createdAtB) {
    return createdAtB - createdAtA
  }
  if (hasCreatedAtA !== hasCreatedAtB) {
    return hasCreatedAtB ? 1 : -1
  }

  return String(b?.createdAt || '').localeCompare(String(a?.createdAt || ''))
}

export { DEFAULT_PROVINCE, canonicalizeDistrict, canonicalizeProvince }
