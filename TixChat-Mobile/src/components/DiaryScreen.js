import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
} from 'react-native'

const DiaryScreen = ({
  onBack,
  onOpenConversations,
  onOpenProfile,
  onOpenFriends,
  onOpenDiscover,
}) => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backText}>Quay lại</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Nhật ký</Text>

        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.placeholderCard}>
          <Text style={styles.placeholderIcon}>📔</Text>
          <Text style={styles.placeholderTitle}>Nhật ký hoạt động</Text>
          <Text style={styles.placeholderDescription}>
            Theo dõi lịch sử hoạt động của bạn sẽ được cập nhật sớm.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tính năng sắp ra mắt</Text>

          <View style={styles.featureItem}>
            <Text style={styles.featureIcon}>📊</Text>
            <View style={styles.featureInfo}>
              <Text style={styles.featureName}>Thống kê hoạt động</Text>
              <Text style={styles.featureDesc}>Xem số tin nhắn, cuộc trò chuyện, thời gian hoạt động</Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <Text style={styles.featureIcon}>📅</Text>
            <View style={styles.featureInfo}>
              <Text style={styles.featureName}>Lịch sử cuộc trò chuyện</Text>
              <Text style={styles.featureDesc}>Xem lại các cuộc trò chuyện đã qua</Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <Text style={styles.featureIcon}>👥</Text>
            <View style={styles.featureInfo}>
              <Text style={styles.featureName}>Nhật ký bạn bè</Text>
              <Text style={styles.featureDesc}>Theo dõi hoạt động kết bạn</Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <Text style={styles.featureIcon}>🏆</Text>
            <View style={styles.featureInfo}>
              <Text style={styles.featureName}>Thành tích</Text>
              <Text style={styles.featureDesc}>Các thành tích đạt được</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.refreshButton} activeOpacity={0.7}>
          <Text style={styles.refreshButtonText}>Khám phá thêm tính năng</Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={onOpenConversations}>
          <Text style={styles.navIcon}>💬</Text>
          <Text style={styles.navText}>Trò chuyện</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={onOpenFriends}>
          <Text style={styles.navIcon}>👥</Text>
          <Text style={styles.navText}>Bạn bè</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={onOpenDiscover}>
          <Text style={styles.navIcon}>🔍</Text>
          <Text style={styles.navText}>Khám phá</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.navItem, styles.navItemActive]} onPress={() => {}}>
          <Text style={styles.navIcon}>📔</Text>
          <Text style={[styles.navText, styles.navTextActive]}>Nhật ký</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={onOpenProfile}>
          <Text style={styles.navIcon}>👤</Text>
          <Text style={styles.navText}>Cá nhân</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backText: {
    fontSize: 16,
    color: '#007AFF',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  placeholderCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  placeholderIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  placeholderTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  placeholderDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  featureIcon: {
    fontSize: 28,
    marginRight: 16,
  },
  featureInfo: {
    flex: 1,
  },
  featureName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  featureDesc: {
    fontSize: 13,
    color: '#999',
  },
  refreshButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  refreshButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingVertical: 8,
    paddingBottom: 24,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  navItemActive: {
    backgroundColor: '#f0f7ff',
    borderRadius: 12,
    marginHorizontal: 4,
  },
  navIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  navText: {
    fontSize: 11,
    color: '#666',
  },
  navTextActive: {
    color: '#007AFF',
    fontWeight: '600',
  },
})

export default DiaryScreen
