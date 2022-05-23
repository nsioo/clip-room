<template>
  <v-dialog v-model="$store.state.export.showDialog" width="700">
    <v-card>
      <v-expansion-panels accordion multiple v-model="panel">
        
        <!-- 导出选项 -->
        <v-expansion-panel>
          <v-expansion-panel-header>
            <div>
              <v-icon class="mr-3">mdi-cog</v-icon>
              导出选项
            </div>
          </v-expansion-panel-header>
          <v-expansion-panel-content>
            <v-text-field
              label="输出 FPS (可选)"
              outlined
              dense
              hide-details="auto"
              class="mb-4"
              v-model="$store.state.export.fps"
              type="number"
            ></v-text-field>
            <v-switch
              v-if="$store.state.export.fps !== ''"
              label="插值帧"
              inset
              dense
              class="interpolate-switch"
              v-model="$store.state.export.interpolate"
            ></v-switch>
            <v-text-field
              label="输出比特率 (MB/s, 可选)"
              outlined
              dense
              v-model="$store.state.export.bitrate"
              hide-details="auto"
              type="number"
            ></v-text-field>
            <v-switch
              v-model="$store.state.export.customResolution"
              inset
              dense
              label="修改分辨率"
            ></v-switch>
            <div class="resolution mb-2">
              <v-text-field
                label="Width"
                outlined
                :disabled="!$store.state.export.customResolution"
                dense
                class="mr-2"
                hide-details="auto"
                v-model="exportWidth"
                type="number"
              ></v-text-field>
              <v-text-field
                label="Height"
                :disabled="!$store.state.export.customResolution"
                outlined
                class="ml-2"
                dense
                hide-details="auto"
                v-model="exportHeight"
                type="number"
              ></v-text-field>
            </div>
          </v-expansion-panel-content>
        </v-expansion-panel>
        <!-- 高级选项 -->
        <v-expansion-panel>
          <v-expansion-panel-header>
            <div>
              <v-icon class="mr-3">mdi-movie-filter-outline</v-icon>
              高级选项
            </div>
          </v-expansion-panel-header>
          <v-expansion-panel-content>
            <v-chip-group class="chip-group" show-arrows>
              <v-chip
                @click="editFilter(filter)"
                color="secondary"
                :close="true"
                class="mb-2"
                @click:close="removeFilter(filter)"
                v-for="filter in selectedFilters"
              >
                {{ filter.name }}{{ filter.options === '' ? '' : '=' }}{{ filter.options }}
              </v-chip>
            </v-chip-group>
            <advanced-export-options></advanced-export-options>
          </v-expansion-panel-content>
        </v-expansion-panel>
        
      </v-expansion-panels>

      <v-divider></v-divider>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn text @click="cancel"> 取消 </v-btn>
        <v-btn color="primary" text @click="confirm">
          导出
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import { mapActions, mapState } from 'vuex';
import path from 'path';
import AdvancedExportOptions from '@/components/AdvancedExportOptions';

export default {
  name: 'ExportDialog',
  components: { AdvancedExportOptions },
  data: () => ({
    pathRules: [(v) => path.isAbsolute(v) || 'Must be a valid path'],
    panel: [0, 1],
  }),
  mounted() {
   
  },
  methods: {
    async editFilter(filter) {
      let { confirmed, value } = await this.showTextPrompt({
        title: `Edit options for filter: ${filter.name}`,
        value: filter.options,
      });

      if (confirmed) {
        filter.options = value;
      }
    },
    removeFilter(filter) {
      this.$store.commit('removeExportFilter', filter);
    },
    cancel() {
      this.$store.commit('showExportDialog', false);
    },
    async confirm() {
      let canceled = await this.exportVideoAs();
      if (!canceled) this.$store.commit('showExportDialog', false);
      
    },
    ...mapActions(['promptVideoExport', 'showTextPrompt', 'exportVideoAs']),
  },
  watch: {
    'export.showDialog'() {
      if (this.export.showDialog) {
        this.panel = [0];
      }
    },
  },
  computed: {
    exportHeight: {
      get: function () {
        let state = this.$store.state;
        return state.export.customResolution
          ? state.export.height
          : state.activeFragment?.video?.height;
      },
      set: function (height) {
        if (this.$store.state.export.customResolution) {
          this.$store.commit('customHeight', height);
        }
      },
    },
    exportWidth: {
      get: function () {
        let state = this.$store.state;
        return state.export.customResolution
          ? state.export.width
          : state.activeFragment?.video?.width;
      },
      set: function (width) {
        if (this.$store.state.export.customResolution) {
          this.$store.commit('customWidth', width);
        }
      },
    },
    ...mapState({
      outputPath: (state) => state.export.outputPath,
      selectedFilters: (state) => state.export.filters,
      export: (state) => state.export,
    }),
  },
};
</script>

<style scoped>
.card-content {
  padding: 24px;
}

.output-path {
  display: flex;
  align-items: center;
}

.output-path > p {
  width: 100%;
  margin-bottom: 0;
  font-size: 15px;
  box-shadow: inset 0 0 0 2px var(--softer-background);
  padding: 8px 15px;
  border-radius: 3px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.interpolate-switch {
  margin-top: -10px;
}

.resolution {
  display: flex;
  align-items: center;
}

.resolution > p {
  vertical-align: middle;
  margin: 0 15px;
  margin-bottom: 25px;
}

.actions {
  display: flex;
  align-items: center;
}

.chip-group {
  max-width: 100%;
}
</style>
