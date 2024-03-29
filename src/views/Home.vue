<template>
  <div class="home" @dragenter="dragEnter" @dragover="dragOver" @dragleave="dragLeave" @drop="drop">
    <div class="home-no-foot">
      <div class="left-panel">
        <editor class="editor" v-if="activeFragment"></editor>
        <div v-else class="no-data">
          <v-icon class="no-data-icon" :size="windowWidth / 5">
            {{ fileHover ? 'mdi-file-plus' : 'mdi-emby' }}
          </v-icon>

          <!-- <v-img class="logo" v-else :src="`img/favicon.ico`"></v-img> -->

          <h1>𝑺𝒕𝒓𝒆𝒂𝒎 𝑪𝒍𝒊𝒑 𝑹𝒐𝒐𝒎</h1>
          <p>将视频拖到此处或单击按钮以开始</p>
          <v-btn
            :disabled="importProjectLoading"
            :loading="importVideoLoading"
            @click="promptVideoInput"
            color="primary"
            rounded
          >
            Import Video
          </v-btn>
          <div class="undo-redo mt-3">
            <v-btn @click="undo" text v-if="canUndo">
              <v-icon small>mdi-undo</v-icon>
              <span class="redo-button">撤回</span>
            </v-btn>
            <v-btn @click="redo" text v-if="canRedo">
              <v-icon small>mdi-redo</v-icon>
              <span class="redo-button">重做</span>
            </v-btn>
          </div>
        </div>
      </div>
      <history v-if="undoStack.length > 0 && scale > 2" class="right-panel"></history>
    </div>
    <v-footer
      class="app-footer"
      :style="{
        opacity: activeFragment ? 1 : 0,
        pointerEvents: activeFragment ? 'all' : 'none',
      }"
    >
      <video-info-footer v-if="activeFragment"></video-info-footer>
      <span v-else class="caption text-uppercase">Stream Clip Room</span>
    </v-footer>
  </div>
</template>

<script>
import { mapActions, mapGetters, mapState } from 'vuex';
import Editor from '@/components/Editor';
import History from '@/components/History';
import VideoInfoFooter from '@/components/VideoInfoFooter';
import path from 'path';
import Utils from '@/js/Utils';

export default {
  name: 'Home',
  components: { VideoInfoFooter, History, Editor },
  data: () => ({
    fileHover: false,
  }),
  mounted() {},
  beforeDestroy() {},
  methods: {
    dragOver(e) {
      e.preventDefault();
      e.stopPropagation();
      this.fileHover = true;
    },
    dragEnter(e) {
      this.fileHover = true;
      e.preventDefault();
    },
    dragLeave(e) {
      this.fileHover = false;
      e.preventDefault();
    },
    async drop(e) {
      e.preventDefault();
      this.fileHover = false;
      let files = e.dataTransfer.files;
      if (files.length === 1 && Utils.isProjectFile(files[0].path)) {
        if (!(await this.discardChangesPrompt())) return;
        this.$store.commit('importProjectLoading', true);
        await this.importProjectByPath(files[0].path);
        this.$store.commit('importProjectLoading', false);
      } else {
        this.$store.commit('importVideoLoading', true);
        await Promise.all([...e.dataTransfer.files].map((f) => this.importVideo(f.path)));
        this.$store.commit('importVideoLoading', false);
      }
    },
    ...mapActions([
      'promptVideoInput',
      'redo',
      'undo',
      'importVideo',
      'importProjectByPath',
      'discardChangesPrompt',
    ]),
  },
  computed: {
    ...mapGetters(['canRedo', 'canUndo', 'scale']),
    ...mapState({
      undoStack: (state) => state.command.undoStack,
      activeFragment: (state) => state.activeFragment,
      importVideoLoading: (state) => state.loading.videoImport,
      importProjectLoading: (state) => state.loading.projectImport,
      windowWidth: (state) => state.windowWidth,
    }),
  },
};
</script>

<style scoped>
.home {
  height: calc(100vh - 64px);
  max-height: calc(100vh - 64px);
  display: flex;
  flex-direction: column;
}

@media (max-width: 959px) {
  .home {
    height: calc(100vh - 56px);
    max-height: calc(100vh - 56px);
  }

  .no-data {
    height: 100% !important;
  }

  .drop-file {
    height: 100% !important;
  }
}

.home-no-foot {
  display: flex;
  height: calc(100% - 44px);
}

.left-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-height: 100%;
  flex-grow: 1;
}

.logo {
  width: 30%;
  transform: scale(0.4);
  /* padding-top: 20px; */
}

.drop-file {
  height: 70%;
  width: 100%;
  display: flex;
  place-content: center;
}

.no-data {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 70%;
  flex-direction: column;
}

.no-data-icon {
  opacity: 0.3;
}

.no-data h1 {
  margin-bottom: 20px;
}

.no-data p {
  margin-bottom: 30px;
  opacity: 0.8;
}

.redo-button {
  text-transform: uppercase;
  margin-left: 10px;
}

.app-footer {
  height: 44px;
}
</style>
