import { mkdir, writeFile } from "node:fs/promises";
import { isIP } from "node:net";
import { resolve } from "node:path";

const host = process.env.LANVORYN_MEDIA_HOST || "127.0.0.1";
if (
	!isIP(host) &&
	!/^(?=.{1,253}$)[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?$/.test(host)
)
	throw new Error("LANVORYN_MEDIA_HOST 必须是可访问的 IP 或 DNS 名称");
await mkdir(".runtime", { recursive: true });
const config = `# 自动生成；MediaMTX 的发布、信令和管理接口仅监听回环地址。
logLevel: info
authMethod: internal
authInternalUsers:
  - user: any
    ips: ['127.0.0.1', '::1']
    permissions:
      - action: publish
        path: live
      - action: read
        path: live
      - action: api
api: true
apiAddress: 127.0.0.1:9997
metrics: false
pprof: false
playback: false
rtsp: true
rtspAddress: 127.0.0.1:8554
rtspTransports: [tcp]
rtmp: false
hls: false
srt: false
moq: false
webrtc: true
webrtcAddress: 127.0.0.1:8889
webrtcAllowOrigins: ['*']
webrtcLocalUDPAddress: :8189
webrtcLocalTCPAddress: :8189
webrtcAdditionalHosts: [${JSON.stringify(host)}]
paths:
  live:
    source: publisher
    maxReaders: 32
    record: false
`;
const target = process.env.LANVORYN_MEDIAMTX_CONFIG || ".runtime/mediamtx.yml";
await mkdir((await import("node:path")).dirname(resolve(target)), {
	recursive: true,
});
await writeFile(target, config, { mode: 0o600 });
console.log(`配置已生成：${resolve(target)}；浏览器媒体连接地址：${host}`);
if (host === "127.0.0.1")
	console.log(
		"当前只适合本机测试。局域网部署前请设置 LANVORYN_MEDIA_HOST 为服务器局域网 IP 并重新生成。",
	);
