"use client";

import React from "react";
import { FieldItem } from "@/data/fieldsData";
import { useFieldTimelapse } from "@/hooks/useFieldTimelapse";
import NdviMetricCard from "@/components/timelapse/NdviMetricCard";
import WeatherDailyCard from "@/components/timelapse/WeatherDailyCard";
import NdviSparklineChart from "@/components/timelapse/NdviSparklineChart";
import TimelapseController from "@/components/timelapse/TimelapseController";

interface PassportTimelapseProps {
  field: FieldItem;
  timelapse: ReturnType<typeof useFieldTimelapse>;
}

export default function PassportTimelapse({ timelapse }: PassportTimelapseProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <NdviMetricCard timelineState={timelapse.timelineState} />
        <WeatherDailyCard
          weather={timelapse.timelineState.weather}
          selectedDate={timelapse.selectedDate}
        />
      </div>

      <NdviSparklineChart
        frames={timelapse.manifest?.frames || []}
        selectedDate={timelapse.selectedDate}
        activeFrameId={timelapse.timelineState.satellite?.id}
        onSelectDate={(d) => {
          const idx = timelapse.dates.indexOf(d);
          if (idx !== -1) timelapse.setDateIndex(idx);
        }}
      />

      <TimelapseController
        dates={timelapse.dates}
        dateIndex={timelapse.dateIndex}
        onDateIndexChange={timelapse.setDateIndex}
        timelineState={timelapse.timelineState}
        isPlaying={timelapse.isPlaying}
        onTogglePlay={() => timelapse.setIsPlaying(!timelapse.isPlaying)}
        speed={timelapse.speed}
        onSpeedChange={timelapse.setSpeed}
        activeLayer={timelapse.activeLayer}
        onLayerChange={timelapse.setActiveLayer}
        onStepNext={timelapse.stepNext}
        onStepPrev={timelapse.stepPrev}
        onJumpObservation={timelapse.jumpToObservation}
        className="shadow-none"
      />
    </div>
  );
}
