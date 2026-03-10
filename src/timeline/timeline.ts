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
}
