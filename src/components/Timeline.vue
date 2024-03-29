<template>
  <perfect-scrollbar class="timeline">
    <div class="timeline-inner" ref="timeline">
      <div
        :title="fragment.fragment.video.fileName"
        class="fragment"
        v-for="(fragment, i) in visualFragments"
        :style="{
          width: fragment.width + 'px',
        }"
        :class="{
          'continues-right': fragment.continuesRight,
          'continues-left': fragment.continuesLeft,
          active: fragment.fragment === activeFragment,
          audio: fragment.fragment.video.isAudio,
        }"
        ref="fragments"
        @mousemove="switchFragment($event, i)"
        @mousedown="moveStart($event, i)"
      >
        <div class="visual-fragment">
          <div
            class="fragment-background"
            v-if="!fragment.fragment.video.isAudio"
            :style="{
              backgroundImage: `url(${fragment.screenshots.merged})`,
              backgroundPositionX: -1 * (fragment.startPixel + fragment.leftPixels) + 'px',
            }"
          ></div>
          <canvas class="audio-wave" ref="audioCanvases"></canvas>
        </div>
        <div
          v-show="activeVisualFragmentIndex === i"
          :style="{
            left: seekLeft + 'px',
          }"
          class="seek-thumb"
        ></div>
      </div>
    </div>
  </perfect-scrollbar>
</template>

<script>
import { mapGetters, mapState } from 'vuex';
import Utils from '@/js/Utils';

export default {
  name: 'Timeline',
  data: () => ({
    bounds: null,
    visualFragments: [],
    renderAudioInterval: -1,
    activeVisualFragmentIndex: null,
    seekLeft: 0,
    fragmentIndex: false,
    contexts: [],
  }),
  beforeDestroy() {
    window.removeEventListener('resize', this.windowResize);
    clearInterval(this.renderAudioInterval);
    document.removeEventListener('mousemove', this.move);
    document.removeEventListener('mouseup', this.moveEnd);
  },
  mounted() {
    this.windowResize();
    window.addEventListener('resize', this.windowResize, false);
    this.renderAudioInterval = setInterval(() => this.windowResize(), 500);
    document.addEventListener('mousemove', this.move, false);
    document.addEventListener('mouseup', this.moveEnd, false);
  },
  methods: {
    switchFragment(e, fragmentIndex) {
      if (this.fragmentIndex !== false && this.fragmentIndex !== fragmentIndex) {
        this.fragmentIndex = fragmentIndex;
        this.seekToProgress(e);
      }
    },
    seekToProgress(e) {
      if (!this.activeFragment.video.canPlay) return;
      const visualFragment = this.visualFragments[this.fragmentIndex];
      const bounds = this.$refs.fragments[this.fragmentIndex].getBoundingClientRect();
      const leftMargin = visualFragment.continuesLeft ? 0 : 10;
      const rightMargin = visualFragment.continuesRight ? 0 : 10;
      const left = bounds.left + leftMargin;
      const width = bounds.width - rightMargin;
      let visualFragmentProgress = e.pageX - left;
      visualFragmentProgress = Math.max(Math.min(visualFragmentProgress / width, 1), 0);
      let fragmentProgress =
        visualFragment.start + visualFragmentProgress * (visualFragment.end - visualFragment.start);
      let { fragment } = visualFragment;
      let videoProgress = Utils.clamp(fragment.start + fragmentProgress * fragment.portion);
      this.$store.commit('activeFragment', fragment);
      fragment.video.element.currentTime = videoProgress * fragment.video.element.duration;
    },
    moveStart(e, fragmentIndex) {
      if (this.activeFragment.video.canPlay) this.$store.commit('showContextMenu', true);
      if (e.button !== 0) return;
      this.fragmentIndex = fragmentIndex;
      this.seekToProgress(e);
    },
    move(e) {
      if (this.fragmentIndex !== false) {
        this.seekToProgress(e);
      }
    },
    moveEnd(e) {
      if (this.fragmentIndex !== false) this.seekToProgress(e);
      this.fragmentIndex = false;
    },
    calculateSeekPosition() {
      const fragmentProgress = this.activeFragment.progress;
      const visualFragmentIndex = this.visualFragments.findIndex(
        (v) =>
          v.fragment === this.activeFragment &&
          v.start <= fragmentProgress &&
          fragmentProgress <= v.end
      );
      if (visualFragmentIndex === -1) return;

      const visualFragment = this.visualFragments[visualFragmentIndex];
      const margin =
        (visualFragment.continuesLeft ? 0 : 10) + (visualFragment.continuesRight ? 0 : 10);
      this.activeVisualFragmentIndex = visualFragmentIndex;
      let visualFragmentProgress =
        (fragmentProgress - visualFragment.start) / (visualFragment.end - visualFragment.start);
      this.seekLeft =
        Math.round(Utils.clamp(visualFragmentProgress) * (visualFragment.width - margin) * 100) /
        100;
    },
    renderAudio() {
      if (!this.$refs.audioCanvases) return;
      if (this.$refs.audioCanvases.length !== this.visualFragments.length) return;

      for (let i = 0; i < this.visualFragments.length; i++) {
        const visFragment = this.visualFragments[i];
        const loudness = visFragment.fragment.video.loudness;
        const fragment = visFragment.fragment;
        const duration = fragment.video.duration;
        const visFragStart =
          visFragment.fragment.start + visFragment.start * visFragment.fragment.portion;
        const visFragEnd =
          visFragment.fragment.start + visFragment.end * visFragment.fragment.portion;

        const canvas = this.$refs.audioCanvases[i];
        const context = this.contexts[i];

        context.fillStyle = this.themeColors.secondary;
        context.strokeStyle = this.themeColors.primary;
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.beginPath();
        context.moveTo(0, canvas.height);

        let visFragmentProgress;
        for (let j = 0; j < loudness.data.length; j++) {
          let { time, db } = loudness.data[j];
          let videoProgress = time / duration;
          if (videoProgress < visFragStart) continue;
          if (videoProgress > visFragEnd) break;

          let fragmentProgress = (videoProgress - fragment.start) / fragment.portion;
          visFragmentProgress =
            (fragmentProgress - visFragment.start) / (visFragment.end - visFragment.start);
          let height =
            ((db - loudness.dbMin) / (loudness.dbMax - loudness.dbMin)) *
            Math.log(1 + visFragment.fragment.volume) *
            loudness.absLoudness *
            canvas.height;
          context.lineTo(visFragmentProgress * canvas.width, canvas.height - height);
        }
        context.lineTo(visFragmentProgress * canvas.width, canvas.height);
        context.lineTo(0, canvas.height);
        context.stroke();
        context.fill();
      }
    },
    updateFragmentsLayout() {
      if (this.fragments.length === 0) return;

      let currentOffsetLeft = 0;
      const visualFragments = [];
      const fragmentQueue = [...this.fragments];
      const fullWidth = this.bounds.width;
      while (fragmentQueue.length > 0) {
        const fragment = fragmentQueue.shift();
        const fits = fragment.width + currentOffsetLeft < fullWidth;
        if (fits) {
          currentOffsetLeft += fragment.width;
          visualFragments.push(fragment);
        } else {
          const splitSizeLeft = fullWidth - currentOffsetLeft;
          const splitSizeRight = fragment.width - splitSizeLeft;
          const leftPartExists = splitSizeLeft > 30;
          const rightPartExists = splitSizeRight > 30;

          if (leftPartExists)
            visualFragments.push({
              ...fragment,
              width: splitSizeLeft,
              continuesRight: rightPartExists,
              end: (fragment.leftPixels + splitSizeLeft) / fragment.fullWidth,
            });

          if (rightPartExists) {
            const leftPixels = fragment.leftPixels + (leftPartExists ? splitSizeLeft : 0);
            fragmentQueue.unshift({
              ...fragment,
              width: splitSizeRight,
              continuesLeft: leftPartExists,
              leftPixels,
              start: leftPixels / fragment.fullWidth,
            });
          }
          currentOffsetLeft = 0;
        }
      }
      this.$nextTick(() => {
        this.calculateSeekPosition();
        if (this.$refs.audioCanvases) {
          this.contexts = this.$refs.audioCanvases.map((c) => c.getContext('2d'));
          for (const canvas of this.$refs.audioCanvases) {
            const bounds = canvas.getBoundingClientRect();
            canvas.width = bounds.width;
          }
          this.renderAudio();
        }
      });
      this.visualFragments = visualFragments;
    },
    windowResize() {
      this.bounds = this.$refs.timeline.getBoundingClientRect();
      requestAnimationFrame(() => this.updateFragmentsLayout());
    },
  },
  watch: {
    playerWidth() {
      this.windowResize();
    },
    fullscreen() {
      this.windowResize();
    },
    activeFragment() {
      requestAnimationFrame(() => this.calculateSeekPosition());
    },
    widthPerSecond() {
      requestAnimationFrame(() => this.updateFragmentsLayout());
    },
    progress() {
      requestAnimationFrame(() => this.calculateSeekPosition());
    },
    'activeFragment.end'() {
      requestAnimationFrame(() => this.updateFragmentsLayout());
    },
    'activeFragment.start'() {
      requestAnimationFrame(() => this.updateFragmentsLayout());
    },
    'activeFragment.playbackRate'() {
      requestAnimationFrame(() => this.updateFragmentsLayout());
    },
    'activeFragment.volume'() {
      requestAnimationFrame(() => this.renderAudio());
    },
    timeline() {
      requestAnimationFrame(() => this.updateFragmentsLayout());
    },
  },
  computed: {
    fragments() {
      return this.timeline.map((fragment) => {
        const pixelWidth = Math.max(
          fragment.adjustedDuration * this.widthPerSecond,
          this.minFragmentWidth
        );
        const videoWidth = this.widthPerSecond * fragment.video.duration;
        return {
          fragment,
          fullWidth: pixelWidth,
          width: pixelWidth,
          screenshots: fragment.video.screenshots,
          continuesRight: false,
          continuesLeft: false,
          start: 0,
          end: 1,
          leftPixels: 0,
          startPixel: fragment.start * videoWidth,
        };
      });
    },
    ...mapGetters([
      'timelineVideos',
      'fragmentAtProgress',
      'themeColors',
      'progressAtFragmentProgress',
    ]),
    ...mapState({
      activeFragment: (state) => state.activeFragment,
      timeline: (state) => state.timeline,
      minFragmentWidth: (state) => state.configTimeline.minFragmentWidth,
      widthPerSecond: (state) => state.configTimeline.widthPerSecond,
      progress: (state) => state.player.progress,
      playerWidth: (state) => state.player.widthPercent,
      fullscreen: (state) => state.player.fullscreen,
    }),
  },
};
</script>

<style scoped>
.timeline {
  --border-radius: 10px;
  max-height: 100%;
  padding: 10px;
  overflow-y: auto;
}

.fragment {
  vertical-align: top;
  height: 125px;
  display: inline-block;
  margin-bottom: 10px;
  padding: 10px;
  border-radius: calc(var(--border-radius) * 1.7);
  cursor: pointer;
  box-shadow: inset 0 0px 0px 0 #5b5b5b;
  transition: box-shadow 0.3s;
}

.visual-fragment {
  width: 100%;
  height: 105px;
  display: inline-flex;
  flex-direction: column;
}

.continues-left.fragment {
  padding-left: 0;
}

.continues-right.fragment {
  padding-right: 0;
}

.fragment > * {
  pointer-events: none;
}

.audio .fragment-background {
  min-height: 0;
  height: 0;
}

.fragment-background {
  /*box-shadow: 0 0 0 1px grey;*/
  border-radius: var(--border-radius) var(--border-radius) 0 0;
  width: 100%;
  min-height: 80px;
  background-color: var(--soft-background);
  background-repeat: repeat;
  background-size: auto 100%;
  background-position: left;
}

.active {
  /*box-shadow: inset 0 -4px 10px 0 #5b5b5b;*/
  /*box-shadow: inset 0 -8px 15px -5px var(--secondary);*/
  /*box-shadow: inset 0 -8px 15px -5px #5b5b5b;*/
  box-shadow: inset 0 0 0 2px var(--softer-background);
}

.continues-right.active {
  clip-path: inset(0px 2px 0px 0px);
}

.continues-left.active {
  clip-path: inset(0px 0px 0px 2px);
}

.continues-left.continues-right.active {
  clip-path: inset(0px 2px 0px 2px);
}

.continues-right .fragment-background,
.continues-right .audio-wave,
.continues-right.fragment {
  border-top-right-radius: 0 !important;
  border-bottom-right-radius: 0 !important;
}

.continues-left .fragment-background,
.continues-left .audio-wave,
.continues-left.fragment {
  border-top-left-radius: 0 !important;
  border-bottom-left-radius: 0 !important;
}

.audio .audio-wave {
  min-height: 105px;
  max-height: 105px;
  border-radius: var(--border-radius);
}

.audio-wave {
  width: 100%;
  min-height: 25px;
  background-color: rgba(80, 80, 80, 0.4);
  border-radius: 0 0 var(--border-radius) var(--border-radius);
}

.audio .seek-thumb {
  margin-top: -113px;
}

.seek-thumb {
  width: 4px;
  height: 105px;
  position: relative;
  background-color: var(--primary);
  box-shadow: 0 0 10px 0 rgba(255, 255, 255, 0.5);
  margin-top: -105px;
  border-radius: 2px;
}
</style>
