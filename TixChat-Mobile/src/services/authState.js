let inMemoryAuth = {
  user: null,
  accessToken: null,
  refreshToken: null,
}

export const getInMemoryAuth = () => ({ ...inMemoryAuth })

export const setInMemoryAuth = (auth = {}) => {
  inMemoryAuth = {
    ...inMemoryAuth,
    ...auth,
  }
}
