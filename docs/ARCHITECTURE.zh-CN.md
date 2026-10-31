# 架构与边界

[English](ARCHITECTURE.md) · **简体中文**

```mermaid
flowchart LR
  V[USB camera / V4L2] --> F[FFmpeg]
  A[USB microphone / ALSA] --> F
  F -->|H.264 + Opus / loopback RTSP| M[MediaMTX]
  B[Browser] -->|Login / settings / authenticated WHEP| S[Fastify]
  S -->|loopback WHEP proxy| M
  M -->|WebRTC media / 8189| B
  S -->|supervise capture| F
```

前端是 React/Vite 单页应用，生产环境由 Fastify 提供静态文件。同源接口避免复杂的跨域凭据配置。播放器使用标准 RTCPeerConnection + WHEP；浏览器只接收媒体，不调用用户设备的摄像头或麦克风。

## 模块

- `packages/shared`：Zod 参数约束、默认设置、DTO 和周计划算法。
- `apps/server/src/auth.ts`：密码验证与内存会话；服务重启后必须重新登录。
- `capture.ts` / `ffmpeg.ts`：单个 FFmpeg 进程、参数数组、退避重试和主动停止。
- `webrtc.ts`：对每个登录会话登记 WHEP 连接，注销、密码变更、撤销或到期时删除对应媒体会话。
- `devices.ts`：V4L2 / ALSA 枚举和受验证的硬件控制。
- `apps/web/src/locales`：八种语言的本地资源，不依赖在线翻译。

MediaMTX 负责媒体路由，不负责把 MJPEG 自动转成 H.264。视频转码在 FFmpeg 中进行；摄像头输入采样率可配置，Opus 发布输出统一为 48 kHz。一个采集源供多个观看者共享，不按观看者重复采集和编码，但每个观看连接都会增加网络带宽。

## 权限

管理员可设置设备、参数、计划和密码；访客仅能读取运行状态并观看。账号由本地交互设置，没有默认密码。密码使用独立随机盐的 scrypt，令牌放 HttpOnly / SameSite=Strict Cookie，不进入 localStorage；localStorage 仅记录语言偏好。

MediaMTX 的信令、管理和 RTSP 只绑定回环地址，内部用户也只允许回环源 IP。外部客户端必须通过 Lanvoryn 认证后才能取得 WebRTC 协商结果。8189 是媒体端口，不是匿名播放网页；媒体使用 WebRTC 的会话密钥。信任本机 OS 和本机用户，不能把这个边界当成本机多用户隔离。

配置写入使用临时文件与原子 rename，带递增 revision，防止多个控制台悄悄覆盖。修改请求串行执行。FFmpeg 与 v4l2-ctl 使用 `execFile`/`spawn` 参数数组，禁用 shell，不接受客户端提交的自定义命令、滤镜表达式或发布 URL。

## 定时语义

每个每周窗口归属于开始日；`22:00–06:00` 表示到次日 06:00。开始包含、结束不包含；重叠窗口取并集。基于指定 IANA 时区的当前墙上时间判断，每 10 秒以内重新计算一次。重启、时钟调整和夏令时变化后重新求当前状态，不补执行错过的历史任务。不存在的本地时刻按实际时区跳变处理，重复时段按当地当前时间判断。

手动开始/停止会切换到手动策略，避免计划下一秒把隐私停止重新打开。想恢复计划，需要重新选择“按计划开放”并保存。空计划始终不采集。定时控制只针对音视频采集，不控制服务器电源。

## 限制

当前为单台 Linux、单个采集源、单进程控制台。播放模式选择独立于采集模式：选择“仅音频”只让该浏览器订阅音频；要让服务器释放摄像头，应关闭视频采集或停止整个采集。浏览器截图/录制保存到观看设备，服务器没有实现全天候录像和保留策略。

不保证固定端到端延迟、任意分辨率性能或所有浏览器硬件解码能力。显示的 RTT 是网络往返时间，不是音视频从现场到屏幕的延迟。字幕、声纹识别、云端分发、双向对讲和无人值守远程升级不在此版本范围。
