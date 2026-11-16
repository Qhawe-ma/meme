import { EventEmitter } from "node:events";

export type LiveEvent = { type: string; [key: string]: unknown };

const bus = new EventEmitter();
bus.setMaxListeners(200);

export function publish(topic: string, event: LiveEvent) {
  bus.emit(topic, event);
}

export function subscribe(topics: string[], listener: (event: LiveEvent) => void) {
  for (const topic of topics) bus.on(topic, listener);
  return () => {
    for (const topic of topics) bus.off(topic, listener);
  };
}
