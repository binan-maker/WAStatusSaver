import * as fs from 'fs';
import * as path from 'path';

// Simulated notification history for status updates
const notificationLog: Array<{
  userId: string;
  title: string;
  body: string;
  imageUrl?: string;
  timestamp: number;
}> = [];

export class NotificationService {
  // Check for new statuses and send notifications
  static checkForNewStatuses(previousCount: number, newCount: number): Array<{
    title: string;
    body: string;
    data: Record<string, string>;
  }> {
    const notifications: Array<{
      title: string;
      body: string;
      data: Record<string, string>;
    }> = [];

    if (newCount > previousCount) {
      const newStatuses = newCount - previousCount;
      notifications.push({
        title: '📸 New Status Available',
        body: `${newStatuses} new status${newStatuses > 1 ? 'es' : ''} saved to your gallery!`,
        data: {
          type: 'new_status',
          count: String(newStatuses),
          timestamp: String(Date.now()),
        },
      });
    }

    return notifications;
  }

  // Log notification sent (for debugging)
  static logNotification(userId: string, title: string, body: string, imageUrl?: string) {
    notificationLog.push({
      userId,
      title,
      body,
      imageUrl,
      timestamp: Date.now(),
    });

    // Keep last 100 notifications in memory
    if (notificationLog.length > 100) {
      notificationLog.shift();
    }
  }

  // Get notification history (for debug/admin)
  static getHistory() {
    return notificationLog;
  }

  // Background task: Simulate status scanning
  static simulateStatusScan(): { newImages: number; newVideos: number } {
    // In production, this would actually scan WhatsApp directories
    // For now, we simulate based on time of day
    const hour = new Date().getHours();
    
    // Simulated activity: more statuses during day hours
    let newImages = 0;
    let newVideos = 0;
    
    if (hour >= 9 && hour <= 23) {
      newImages = Math.random() < 0.3 ? Math.floor(Math.random() * 5) + 1 : 0;
      newVideos = Math.random() < 0.2 ? Math.floor(Math.random() * 2) + 1 : 0;
    }

    return { newImages, newVideos };
  }
}
