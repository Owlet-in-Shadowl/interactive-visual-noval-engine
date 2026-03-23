/**
 * Timeline System - Manages macro world events and micro character actions.
 * Implements discrete-event simulation with conflict detection.
 */

import type { WorldEvent, WorldState } from '../memory/schemas';

export class Timeline {
  private currentTime: number;
  private events: WorldEvent[];
  private locations: Array<{ id: string; name: string }>;

  constructor(
    initialTime: number,
    events: WorldEvent[],
    locations: Array<{ id: string; name: string }>,
  ) {
    this.currentTime = initialTime;
    this.events = events.sort((a, b) => a.time - b.time);
    this.locations = locations;
  }

  getCurrentTime(): number {
    return this.currentTime;
  }

  formatTime(minutes?: number): string {
    const m = minutes ?? this.currentTime;
    const h = Math.floor(m / 60);
    const min = m % 60;
    return `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
  }

  /**
   * Check if advancing by `duration` minutes would hit a world event.
   * Returns the conflicting event if found, null otherwise.
   */
  checkConflict(duration: number): WorldEvent | null {
    const endTime = this.currentTime + duration;
    return (
      this.events.find(
        (e) => e.time > this.currentTime && e.time <= endTime,
      ) ?? null
    );
  }

  /**
   * Advance time. If a conflict exists, only advance to the event time.
   * Returns { advanced, interrupted, event? }
   */
  advance(duration: number): {
    advanced: number;
    interrupted: boolean;
    event?: WorldEvent;
  } {
    const conflict = this.checkConflict(duration);

    if (conflict) {
      const advanced = conflict.time - this.currentTime;
      this.currentTime = conflict.time;
      return { advanced, interrupted: true, event: conflict };
    }

    this.currentTime += duration;
    return { advanced: duration, interrupted: false };
  }

  /**
   * Get all upcoming events within the next `window` minutes.
   */
  getUpcoming(window: number = 240): WorldEvent[] {
    const endTime = this.currentTime + window;
    return this.events.filter(
      (e) => e.time > this.currentTime && e.time <= endTime,
    );
  }

  /**
   * Get active events (events that have occurred and are still relevant).
   */
  getActiveEvents(): WorldEvent[] {
    return this.events.filter(
      (e) => e.time <= this.currentTime && e.time > this.currentTime - 60,
    );
  }

  /**
   * Build a WorldState snapshot for the current time.
   */
  buildWorldState(
    currentLocation: string,
    availableNPCs: string[],
    situation: string,
  ): WorldState {
    return {
      currentTime: this.currentTime,
      currentLocation,
      activeEvents: this.getActiveEvents(),
      availableLocations: this.locations.map((l) => l.id),
      availableNPCs,
      currentSituation: situation,
    };
  }

  getLocationName(id: string): string {
    return this.locations.find((l) => l.id === id)?.name ?? id;
  }

  // ─── P0：预置场景支持 ─────────────────────────────────

  /**
   * 查看下一个未处理的事件（不消费、不推进时间）
   */
  peekNextEvent(): WorldEvent | null {
    return (
      this.events.find((e) => e.time > this.currentTime) ?? null
    );
  }

  /**
   * 时间跳转到指定事件
   */
  advanceToEvent(eventId: string): void {
    const event = this.events.find((e) => e.id === eventId);
    if (event && event.time >= this.currentTime) {
      this.currentTime = event.time;
    }
  }

  /**
   * 判断事件是否有参与框架（预置内容）
   */
  hasFrames(event: WorldEvent): boolean {
    return Array.isArray(event.frames) && event.frames.length > 0;
  }

  /**
   * 检查当前章节的所有事件是否都已消费（时间已过）
   */
  allEventsConsumed(): boolean {
    return this.events.length > 0 && this.events.every((e) => e.time <= this.currentTime);
  }

  /**
   * 替换事件和地点（章节切换时使用）
   * 重置时间指针到新事件的起点之前。
   */
  replaceEvents(
    events: WorldEvent[],
    locations: Array<{ id: string; name: string }>,
    initialTime?: number,
  ): void {
    this.events = events.sort((a, b) => a.time - b.time);
    this.locations = locations;
    if (initialTime !== undefined) {
      this.currentTime = initialTime;
    } else if (this.events.length > 0) {
      // 将时间设置到第一个事件之前（确保 peekNextEvent 能返回它）
      this.currentTime = Math.min(this.currentTime, this.events[0].time - 1);
    }
  }
}
