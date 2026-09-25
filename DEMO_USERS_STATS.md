# Số liệu minh họa trên trang Users

Mở `/users` khi cần chụp màn hình hoặc trình bày. Chỉ bốn thẻ thống kê trên trang Users dùng số liệu minh họa theo mặc định:

| Thẻ | Giá trị demo |
| --- | ---: |
| Tổng người dùng | 568 |
| User mới gần đây (7 ngày) | 42 |
| User mới trong tháng (30 ngày) | 133 |
| Đang hoạt động (30 ngày) | 317 |

Nhãn “hôm nay” trên thẻ 7 ngày là 8. Các giá trị này nằm trong `DEMO_USER_STATS` ở `src/app/(dashboard)/users/page.tsx`. Trang đánh dấu rõ khi chế độ demo bật. API `/api/users`, danh sách tài khoản, bộ lọc và phân trang vẫn sử dụng dữ liệu thật; vì vậy số trên thẻ demo không nhất thiết khớp số tài khoản trong danh sách sau khi lọc.

## Hoàn nguyên dữ liệu thật

Mở `/users?realStats=1` để bốn thẻ hiển thị số liệu thật từ API ngay. Không có bản ghi Supabase nào bị thêm hoặc sửa nên không cần khôi phục cơ sở dữ liệu.

Khi không cần chế độ demo nữa, xóa `DEMO_USER_STATS`, state `demoStatsEnabled`, effect đọc URL, dòng thông báo demo và đổi các tham chiếu `displayedStats` trong `src/app/(dashboard)/users/page.tsx` về `stats`; sau đó xóa file hướng dẫn này.
