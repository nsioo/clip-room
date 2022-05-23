<template>
  <v-dialog v-model="$store.state.exportStatus.show" width="700">
    <v-card :loading="true">
      <template slot="progress">
        <v-progress-linear
          v-if="status.error !== ''"
          color="warning"
          :value="100"
        ></v-progress-linear>
        <v-progress-linear
          :indeterminate="exportProgress <= 0"
          v-else-if="isExporting || status.done"
          color="success"
          :value="exportProgress * 100"
        ></v-progress-linear>
      </template>
     
      <v-card-title v-if="isExporting">
        正在导出
      </v-card-title>
      <v-card-title v-else-if="status.error !== ''">
        <v-icon color="warning" class="mr-2">mdi-alert-outline</v-icon>
        视频导出出错！
      </v-card-title>
      <v-card-title v-else>
        <v-icon color="success" class="mr-2">mdi-check</v-icon>
        导出成功
      </v-card-title>
      <v-card-subtitle>
        {{ outputPath }}
      </v-card-subtitle>
      <v-card-text v-if="isExporting">
        {{ speed }}
      </v-card-text>
      <div v-if="status.error !== ''">
        <v-card-text class="error--text">
          {{ status.error }}
        </v-card-text>
        <v-divider></v-divider>
      </div>
      <perfect-scrollbar class="output" v-if="status.output.length > 0">
        <v-expansion-panels>
          <v-expansion-panel>
            <v-expansion-panel-header>显示详情</v-expansion-panel-header>
            <v-expansion-panel-content>
              <p class="output-line" v-for="line in status.output">{{ line }}</p>
            </v-expansion-panel-content>
          </v-expansion-panel>
        </v-expansion-panels>
      </perfect-scrollbar>
      <v-divider></v-divider>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn
          text
          color="error"
          @click="abort"
          v-if="isExporting && status.error === ''"
        >
          终止
        </v-btn>
        <v-btn text @click="dismiss" v-else-if="status.error !== ''"> 关闭 </v-btn>
        <div v-else>
          <v-tooltip top>
            <template v-slot:activator="{ on, attrs }">
              <v-btn class="mr-2" icon @click="openFolder(outputPath)" v-bind="attrs" v-on="on">
                <v-icon>mdi-folder-outline</v-icon>
              </v-btn>
            </template>
            <span>打开所在文件夹</span>
          </v-tooltip>
          <v-tooltip top>
            <template v-slot:activator="{ on, attrs }">
              <v-btn class="mr-6" icon @click="openFile(outputPath)" v-bind="attrs" v-on="on">
                <v-icon>mdi-play</v-icon>
              </v-btn>
            </template>
            <span>打开视频</span>
          </v-tooltip>
          <v-btn text @click="dismiss"> 关闭 </v-btn>
        </div>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import { mapActions, mapGetters, mapState } from 'vuex';
import Utils from '@/js/Utils';

export default {
  name: 'ExportStatus',
  data: () => ({}),
  methods: {
    dismiss() {
      this.$store.commit('showExportStatus', false);
    },
    abort() {
      if (this.isExporting) {
        this.status.command.kill();
      }
    },
    ...mapActions([
      'openFile',
      'cancelUpload',
      'openFolder',
      'showTextPrompt',
      'resetExportStatus',
    ]),
  },
  watch: {
    'status.show'() {
      if (!this.status.show && this.status.error !== '') {
        // when dismissing error, reset status stuff
        this.resetExportStatus();
      }
    },
  },
  computed: {
    speed() {
      if (this.isExporting) {
        let time = this.status.progress.timemark?.substr(3) ?? '00:00.00';
        return `已导出: ${time} / ${this.toHms(this.fullDuration)}`;
      }
      return '';
    },
    ...mapGetters(['exportProgress', 'isExporting', 'fullDuration', 'toHms']),
    ...mapState({
      status: (state) => state.exportStatus,
      outputPath: (state) => state.export.outputPath,
    }),
  },
};
</script>

<style scoped>
.output {
  max-height: 500px;
  overflow-y: auto;
}

.output-line {
  margin: 0 10px;
  font-size: 13px;
  opacity: 0.8;
  font-family: monospace;
}
</style>
