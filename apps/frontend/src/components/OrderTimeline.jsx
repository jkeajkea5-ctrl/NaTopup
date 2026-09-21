import React from "react";
import { CheckCircle2, Loader2, Circle, AlertCircle } from "lucide-react";

export const OrderTimeline = ({ timeline, status }) => {
  return (
    <div className="py-4">
      <div className="relative flex flex-col space-y-8 before:absolute before:inset-0 before:left-4 before:h-full before:w-0.5 before:bg-brand-border">
        {timeline.map((item, idx) => {
          const isCompleted = item.completed;
          const isActive = item.active || (!isCompleted && idx > 0 && timeline[idx - 1].completed);
          const isFailed = status === "FAILED" && idx === timeline.length - 1;

          return (
            <div key={item.step} className="relative flex items-start group">
              <div
                className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all ${
                  isFailed
                    ? "bg-brand-danger border-brand-danger text-white shadow-soft"
                    : isCompleted
                    ? "gradient-brand border-brand-violet text-white shadow-soft"
                    : isActive
                    ? "bg-brand-surface border-brand-blue text-brand-blue shadow-glow animate-pulse"
                    : "bg-brand-surface border-brand-border text-brand-muted"
                }`}
              >
                {isFailed ? (
                  <AlertCircle className="w-4 h-4" />
                ) : isCompleted ? (
                  <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                ) : isActive ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Circle className="w-2.5 h-2.5 fill-current opacity-30" />
                )}
              </div>

              <div className="ml-4 flex-1">
                <div className="flex items-center justify-between">
                  <h4
                    className={`font-heading font-semibold text-sm ${
                      isCompleted
                        ? "text-brand-text"
                        : isActive
                        ? "text-brand-blue"
                        : "text-brand-muted"
                    }`}
                  >
                    {item.title}
                  </h4>
                  {item.time && (
                    <span className="text-[11px] text-brand-muted font-mono">
                      {new Date(item.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                </div>
                <p className="text-xs text-brand-muted mt-0.5">
                  {isCompleted
                    ? "ជោគជ័យរួចរាល់"
                    : isActive
                    ? "កំពុងដំណើរការ..."
                    : "រង់ចាំជំហានមុន"}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
