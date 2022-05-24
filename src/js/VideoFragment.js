export default class VideoFragment {
  constructor(videoFile, id) {
    this.video = videoFile; // 资源路径
    this.start = 0; // 开始时间
    this.end = 1; // 结束时间
    this.playbackRate = 1; // 播放速度
    this.volume = 1; // 音量
    if (id !== undefined) {
      this.id = id;
      VideoFragment.id = id + 1;
    } else {
      this.id = VideoFragment.id++;
    }
  }

  // 创建一个新的视频片段
  get portion() {
    return this.end - this.start;
  }

  // 重置
  reset() {
    if (this.video.element === null) return;
    this.video.element.pause(); // 暂停
    this.video.element.currentTime = this.start * this.video.duration;
  }

  // 播放进度
  get progress() {
    if (this.video.element === null) return 0;
    let videoProgress = this.video.element.currentTime / this.video.duration;
    return (videoProgress - this.start) / this.portion;
  }

  // 调整播放速率后的视频时长
  get adjustedDuration() {
    if (this.video.element === null) return 0;
    let duration = this.video.duration / this.playbackRate;
    let adjusted = duration * this.portion;
    return isNaN(adjusted) ? 0 : adjusted;
  }

  // 转为对象
  static fromObject(videoFile, obj) {
    let fragment = new VideoFragment(videoFile, obj.id);
    fragment.start = obj.start;
    fragment.end = obj.end;
    fragment.volume = obj.volume;
    fragment.playbackRate = obj.playbackRate;
    return fragment;
  }
}

VideoFragment.id = 0;
