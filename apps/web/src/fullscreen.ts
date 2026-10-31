type NativeVideo = HTMLVideoElement & {
	webkitEnterFullscreen?: () => void;
	webkitSupportsFullscreen?: boolean;
};

// 必须直接从点击事件调用，保留手机浏览器要求的用户手势。
export async function enterFullscreen(
	stage: HTMLElement | null,
	video: HTMLVideoElement | null,
	hasVideo: boolean,
): Promise<boolean> {
	if (stage?.requestFullscreen) {
		try {
			await stage.requestFullscreen();
			return true;
		} catch {
			/* 尝试视频专用接口。 */
		}
	}
	const native = video as NativeVideo | null;
	if (
		hasVideo &&
		native?.webkitEnterFullscreen &&
		native.webkitSupportsFullscreen !== false
	) {
		try {
			native.webkitEnterFullscreen();
			return true;
		} catch {
			/* 使用页面内铺满。 */
		}
	}
	return false;
}
