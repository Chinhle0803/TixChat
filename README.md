# TixChat - Hệ thống Giao tiếp và Trợ lý Đô thị Thông minh

TixChat là một nền tảng giao tiếp cộng đồng đa nền tảng (Web, Mobile), cung cấp trải nghiệm nhắn tin thời gian thực, gọi video liền mạch, cùng các tiện ích thông minh dành riêng cho môi trường đô thị như Bảng tin Sự cố và Trợ lý AI.

Dự án cung cấp bộ giải pháp tổng thể bao gồm Backend, Web Frontend và Mobile App.

## Chức năng nổi bật

Toàn bộ các tính năng cốt lõi đã được hoàn thiện và tích hợp đầy đủ vào hệ thống:

- **Nhắn tin Thời gian thực**: Chat cá nhân (1:1) và Chat nhóm với tốc độ cao, hỗ trợ gửi đính kèm đa phương tiện.
- **Gọi Video & Audio (Mobile & Web)**: 
  - Gọi video 1:1 và gọi nhóm ổn định với Amazon Chime SDK.
  - Quản lý thiết bị linh hoạt (camera, audio routing).
  - Tối ưu hóa UI/UX với Video Tile Grid trên thiết bị di động.
- **Push Notifications**: Cập nhật tức thì các sự kiện tin nhắn mới, cuộc gọi đến, và cảnh báo về khu vực đô thị qua EAS/FCM.
- **Bảng tin Sự cố Đô thị (Urban Incident Feed)**:
  - Cho phép người dùng báo cáo, cập nhật các sự cố hạ tầng, giao thông, môi trường.
  - Tích hợp thông tin không gian, đính kèm hình ảnh.
- **Smart Assistant (AI Chatbot)**: 
  - Chatbot thông minh hỗ trợ giải đáp tự động các thắc mắc về đô thị, sự cố giao thông, hạ tầng.
  - Tích hợp công nghệ RAG truy xuất dữ liệu từ các báo cáo thời gian thực.

## 🛠 Công nghệ sử dụng

- **Backend**: Node.js 20, Express.js, Socket.IO
- **Frontend (Web)**: React.js, Vite
- **Mobile App**: React Native (Expo)
- **Cơ sở dữ liệu**: AWS DynamoDB, Redis
- **Lưu trữ & Truyền thông**: AWS S3 (Files/Images), Amazon Chime SDK (Video/Audio Calls)
- **Phân phối Thông báo**: EAS Push Service, Firebase Cloud Messaging (FCM)
- **AI & ML**: Tích hợp Provider AI + RAG Architecture.
- **Triển khai & CI/CD**: Docker, GitHub Actions, AWS EC2

## Cấu trúc Dự án

Dự án được triển khai theo mô hình Monorepo chứa các thành phần độc lập:

- `/TixChat-Backend`: Mã nguồn máy chủ xử lý API, Realtek Socket, kết nối Database và AWS Services.
- `/TixChat-Frontend`: Ứng dụng Web Client dành cho trình duyệt.
- `/TixChat-Mobile`: Ứng dụng di động (Android/iOS) phát triển bằng React Native.
- `/docs`: Thiết kế hệ thống, kiến trúc cơ sở dữ liệu, biểu đồ UML.

## Hướng dẫn Cài đặt

### Yêu cầu hệ thống
- Node.js 20+
- Docker & Docker Compose
- Tài khoản AWS (DynamoDB, S3, Chime)
- Expo CLI (đối với ứng dụng Mobile)

### Môi trường Local

**1. Khởi chạy Backend**
```bash
cd TixChat-Backend
npm install
npm run dev
# Hoặc sử dụng Docker: docker-compose up -d
```

**2. Khởi chạy Frontend (Web)**
```bash
cd TixChat-Frontend
npm install
npm run dev
```

**3. Khởi chạy Mobile App**
```bash
cd TixChat-Mobile
npm install
npx expo start
```


## License & Bản quyền

Dự án được phân phối với giấy phép MIT. Phụ vụ cho mục đích phát triển giáo dục và cộng đồng.
