<template>
  <div class="video-info">
    <div class="info-text">
      <span @click="openFolder(video.filePath)" v-ripple class="clickable not-uppercase"
        >正在编辑: {{ video.fileName }}</span
      >
      <span>片段长度: {{ toHms(activeFragment.adjustedDuration) }}</span>
      <span>分辨率: {{ video.width }}<span class="not-uppercase">x</span>{{ video.height }}</span>
      <span>fps: {{ video.fps }}</span>
      <span
        >比特率: <span class="not-uppercase">{{ readableBitrate(video.bitrate) }}</span></span
      >
    </div>
    <v-slider
      hide-details
      class="zoom-slider"
      @click:prepend="rawWps = 3.5"
      dense
      min="0.1"
      @wheel.native="wheel"
      max="7"
      step="0.01"
      prepend-icon="mdi-magnify-plus-outline"
      v-model="rawWps"
    ></v-slider>
  </div>
</template>

<script>
import { mapActions, mapGetters, mapState } from 'vuex';
import Utils from '@/js/Utils';

export default {
  name: 'VideoInfoFooter',
  data: () => ({
    rawWps: 3.5,
  }),
  mounted() {
    this.setRawWps();
  },
  methods: {
    readableBitrate(bitrate) {
      return Utils.readableBytes(bitrate, true) + '/s';
    },
    wheel(e) {
      this.rawWps -= e.deltaY * 0.0001;
    },
    setRawWps() {
      let wps = this.widthPerSecond;
      let centerValue = 3;
      if (wps > centerValue) wps = centerValue + (wps - centerValue) / 5;
      this.rawWps = wps;
    },
    ...mapActions(['openFolder']),
  },
  watch: {
    rawWps() {
      let centerValue = 3;
      let wps = this.rawWps;
      if (wps > centerValue) wps = centerValue + (wps - centerValue) * 5;
      this.$store.commit('widthPerSecond', wps);
    },
  },
  computed: {
    ...mapGetters(['toHms']),
    video() {
      return this.activeFragment.video;
    },
    ...mapState({
      activeFragment: (state) => state.activeFragment,
      widthPerSecond: (state) => state.configTimeline.widthPerSecond,
    }),
  },
};
</script>

<style scoped>
.video-info {
  overflow: hidden;
  display: flex;
  justify-content: space-between;
  width: 100%;
}

.info-text {
  height: 100%;
  line-height: 22px;
  vertical-align: middle;
  width: calc(100% - 135px);
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
}

.info-text > span {
  opacity: 0.7;
  text-transform: uppercase;
  font-size: 12px;
  margin-right: 20px;
  padding: 5px 10px;
}

.not-uppercase {
  text-transform: none !important;
}

.clickable {
  display: inline-block;
  border-radius: 3px;
  cursor: pointer;
  text-shadow: 0 0 10px transparent;
  transition: text-shadow 0.15s;
}

.zoom-slider {
  min-width: 130px;
  max-width: 130px;
}
</style>
