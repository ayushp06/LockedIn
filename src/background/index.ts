// Background service worker for LockedIn Chrome Extension
console.log('LockedIn background service worker started');

interface WorkTrackerData {
  workSites: string[];
  currentWorkTime: number;
  isWorking: boolean;
  startTime: number;
  dailyWorkTime: number;
  lastResetDate: string;
  currentSessionId?: string;
  currentWebsite?: string;
  userId?: string;
}

class WorkTracker {
  private data: WorkTrackerData = {
    workSites: [], // Start empty - users add their own sites
    currentWorkTime: 0,
    isWorking: false,
    startTime: 0,
    dailyWorkTime: 0,
    lastResetDate: new Date().toDateString()
  };

  private isUserActive: boolean = true;
  private isSystemActive: boolean = true;
  private lastActivityTime: number = Date.now();
  private activityCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.initialize();
  }

  private async initialize() {
    await this.loadData();
    await this.registerContentScriptsForTrackedSites();
    this.setupEventListeners();
    this.startTracking();
    this.resetDailyIfNeeded();
  }

  // Dynamically register content scripts for tracked sites
  private async registerContentScriptsForTrackedSites() {
    try {
      // Get existing registered scripts
      const existingScripts = await chrome.scripting.getRegisteredContentScripts();
      const existingIds = new Set(existingScripts.map(s => s.id));

      // Register content script for each tracked site
      for (const site of this.data.workSites) {
        const scriptId = `lockedin-${site.replace(/\./g, '-')}`;
        
        // Skip if already registered
        if (existingIds.has(scriptId)) {
          console.log('✅ Content script already registered for:', site);
          continue;
        }

        const httpsPattern = `https://*.${site}/*`;
        const httpPattern = `http://*.${site}/*`;
        
        // Request permission for this site
        const hasPermission = await chrome.permissions.contains({
          origins: [httpsPattern, httpPattern]
        });

        if (!hasPermission) {
          console.log('📋 Permission needed for:', site);
          // Permission requests need user interaction, handled in addWorkSite
          continue;
        }

        // Register content script
        await chrome.scripting.registerContentScripts([{
          id: scriptId,
          js: ['content.js'],
          matches: [httpsPattern, httpPattern],
          runAt: 'document_end'
        }]);

        console.log('✅ Registered content script for:', site);
      }
    } catch (error) {
      console.error('Error registering content scripts:', error);
    }
  }

  // Register content script for a single site (permission already granted from popup)
  private async registerContentScriptForSite(site: string): Promise<void> {
    const scriptId = `lockedin-${site.replace(/\./g, '-')}`;
    const httpsPattern = `https://*.${site}/*`;
    const httpPattern = `http://*.${site}/*`;

    try {
      // Check if already registered
      const existingScripts = await chrome.scripting.getRegisteredContentScripts();
      if (existingScripts.some(s => s.id === scriptId)) {
        console.log('✅ Content script already registered for:', site);
        return;
      }

      // Verify permission exists (should already be granted from popup)
      const hasPermission = await chrome.permissions.contains({
        origins: [httpsPattern, httpPattern]
      });

      if (!hasPermission) {
        throw new Error('Permission not granted for this site');
      }

      // Register content script for both http and https
      await chrome.scripting.registerContentScripts([{
        id: scriptId,
        js: ['content.js'],
        matches: [httpsPattern, httpPattern],
        runAt: 'document_end'
      }]);

      console.log('✅ Registered content script for:', site);
    } catch (error) {
      console.error('Failed to register content script for', site, error);
      throw error;
    }
  }

  private async loadData() {
    try {
      const result = await chrome.storage.local.get(['workTrackerData']);
      if (result.workTrackerData) {
        this.data = { ...this.data, ...result.workTrackerData };
      }
      await this.saveData();
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  }

  private async saveData() {
    try {
      await chrome.storage.local.set({ workTrackerData: this.data });
    } catch (error) {
      console.error('Failed to save data:', error);
    }
  }

  private setupEventListeners() {
    // Listen for tab updates
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab.url) {
        this.checkWorkSite(tab.url);
      }
    });

    // Listen for tab activation
    chrome.tabs.onActivated.addListener(async (activeInfo) => {
      try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        if (tab.url) {
          this.checkWorkSite(tab.url);
        }
      } catch (error) {
        console.error('Error getting tab:', error);
      }
    });

    // Listen for window focus changes
    chrome.windows.onFocusChanged.addListener(async (windowId) => {
      if (windowId === chrome.windows.WINDOW_ID_NONE) {
        // Chrome lost focus - but DON'T pause tracking
        // The user might just be looking at the popup
        // Only pause if the user is actually idle (handled by idle listener)
        console.log('Chrome lost focus, but continuing to track');
      } else {
        // Chrome gained focus - check if we're on a work site
        try {
          const [tab] = await chrome.tabs.query({ active: true, windowId: windowId });
          if (tab?.url) {
            this.checkWorkSite(tab.url);
          }
        } catch (error) {
          console.error('Error checking active tab:', error);
        }
      }
    });

    // Listen for idle state changes (detects sleep mode and user inactivity)
    chrome.idle.onStateChanged.addListener((state) => {
      console.log('🔔 Idle state changed:', state);
      if (state === 'active') {
        console.log('✅ System/user became active');
        this.isUserActive = true;
        this.isSystemActive = true;
        this.lastActivityTime = Date.now();
        // Resume tracking if we're on a work site
        this.checkCurrentTab();
      } else if (state === 'locked') {
        // System is locked/sleeping - STOP tracking
        console.log('🔒 System locked/sleeping - pausing tracking');
        this.isSystemActive = false;
        this.pauseTracking();
      } else if (state === 'idle') {
        // User is idle but system is not locked
        // STOP tracking when idle (not just mark inactive)
        console.log('😴 User idle for 30+ minutes - pausing tracking');
        this.isUserActive = false;
        this.pauseTracking();
      }
    });

    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true; // Keep message channel open for async response
    });

    // Listen for extension installation
    chrome.runtime.onInstalled.addListener(async (details) => {
      console.log('LockedIn extension installed/updated:', details.reason);
      this.setupBadge();
      // Set idle detection to 30 minutes (1800 seconds of inactivity)
      chrome.idle.setDetectionInterval(1800);
      
      // Re-register content scripts for tracked sites that already have permissions
      await this.registerContentScriptsForTrackedSites();
    });

    // Detect system suspend/resume by checking for large time gaps
    this.startSuspendDetection();
  }

  private async checkCurrentTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.url) {
        this.checkWorkSite(tab.url);
      }
    } catch (error) {
      console.error('Error checking current tab:', error);
    }
  }

  private checkWorkSite(url: string) {
    const isWorkSite = this.data.workSites.some(site => url.includes(site));
    
    console.log('Checking work site:', {
      url,
      isWorkSite,
      isWorking: this.data.isWorking,
      isUserActive: this.isUserActive,
      isSystemActive: this.isSystemActive,
      workSites: this.data.workSites
    });
    
    if (isWorkSite && !this.data.isWorking && this.isSystemActive) {
      console.log('Starting work - work site and system active');
      this.startWork();
    } else if ((!isWorkSite || !this.isSystemActive) && this.data.isWorking) {
      console.log('Stopping work - conditions not met:', {
        isWorkSite,
        isSystemActive: this.isSystemActive
      });
      this.stopWork();
    }
  }

  private pauseTracking() {
    if (this.data.isWorking) {
      console.log('⏸️ Pausing tracking due to inactivity/sleep');
      this.stopWork();
    }
  }

  private async startWork() {
    this.data.isWorking = true;
    this.data.startTime = Date.now();
    this.updateBadge('ON');
    
    // Get current website for session tracking
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.url) {
        const url = new URL(tab.url);
        this.data.currentWebsite = url.hostname;
        
        // Start Firebase work session if user is logged in
        if (this.data.userId && !this.data.currentSessionId) {
          try {
            // Dynamically import Firebase service to avoid blocking background script startup
            const { WorkSessionService } = await import('../services/firebase');
            this.data.currentSessionId = await WorkSessionService.startSession(
              this.data.userId,
              this.data.currentWebsite
            );
            await this.saveData();
            console.log('🎯 Started Firebase session:', this.data.currentSessionId);
          } catch (firebaseError) {
            console.log('Firebase session not started (user may not be logged in):', firebaseError);
            // Continue tracking locally even if Firebase fails
          }
        }
      }
    } catch (error) {
      console.error('Error starting work session:', error);
    }
    
    console.log('▶️ Started working at', new Date().toLocaleTimeString());
  }

  private async stopWork() {
    if (this.data.isWorking) {
      const workDuration = Date.now() - this.data.startTime;
      this.data.currentWorkTime += workDuration;
      this.data.dailyWorkTime += workDuration;
      this.data.isWorking = false;
      this.updateBadge('OFF');
      
      // End Firebase work session if one exists
      if (this.data.currentSessionId) {
        try {
          // Dynamically import Firebase service
          const { WorkSessionService } = await import('../services/firebase');
          await WorkSessionService.endSession(this.data.currentSessionId);
          console.log('🏁 Ended Firebase session:', this.data.currentSessionId);
        } catch (error) {
          console.log('Firebase session not ended (user may not be logged in):', error);
          // Continue with local tracking
        } finally {
          // Always clear session data
          this.data.currentSessionId = undefined;
          this.data.currentWebsite = undefined;
        }
      }
      
      await this.saveData();
      // Sync to Firebase if user is logged in
      this.syncToFirebase();
      console.log('⏹️ Stopped working. Added', 
        Math.round(workDuration / 1000), 'seconds. Daily total:', 
        Math.round(this.data.dailyWorkTime / 1000 / 60), 'minutes');
    }
  }

  private updateBadge(text: string) {
    chrome.action.setBadgeText({ text });
    chrome.action.setBadgeBackgroundColor({ 
      color: text === 'ON' ? '#10b981' : '#6b7280' 
    });
  }

  private setupBadge() {
    chrome.action.setBadgeText({ text: 'OFF' });
    chrome.action.setBadgeBackgroundColor({ color: '#6b7280' });
  }

  private startSuspendDetection() {
    // Check every 5 seconds for time gaps that indicate system suspend
    this.activityCheckInterval = setInterval(async () => {
      const now = Date.now();
      const timeSinceLastCheck = now - this.lastActivityTime;
      
      // If more than 10 seconds have passed, system was likely suspended
      if (timeSinceLastCheck > 10000) {
        console.log('⚠️ System suspend/sleep detected! Time gap:', 
          Math.round(timeSinceLastCheck / 1000), 'seconds');
        
        // If we were tracking, stop and save time BEFORE sleep
        if (this.data.isWorking) {
          // Calculate work duration up to the LAST check (before sleep)
          // Don't include the sleep time!
          const workBeforeSleep = this.lastActivityTime - this.data.startTime;
          if (workBeforeSleep > 0) {
            this.data.currentWorkTime += workBeforeSleep;
            this.data.dailyWorkTime += workBeforeSleep;
            console.log('✅ Saved', Math.round(workBeforeSleep / 1000), 
              'seconds of work before sleep');
          }
          
          // End Firebase session before marking as not working
          if (this.data.currentSessionId) {
            try {
              // Dynamically import Firebase service
              const { WorkSessionService } = await import('../services/firebase');
              await WorkSessionService.endSession(this.data.currentSessionId);
              console.log('🏁 Ended Firebase session due to sleep:', this.data.currentSessionId);
            } catch (error) {
              console.log('Firebase session not ended (user may not be logged in):', error);
            } finally {
              // Always clear session data
              this.data.currentSessionId = undefined;
              this.data.currentWebsite = undefined;
            }
          }
          
          this.data.isWorking = false;
          this.updateBadge('OFF');
          await this.saveData();
          this.syncToFirebase();
        }
        
        // Mark system as active again and check if we should resume
        this.isSystemActive = true;
        this.checkCurrentTab();
      }
      
      this.lastActivityTime = now;
    }, 5000);
  }

  private startTracking() {
    // Update work time every 5 seconds for more responsive tracking
    setInterval(() => {
      if (this.data.isWorking && this.isSystemActive) {
        const workDuration = Date.now() - this.data.startTime;
        this.data.currentWorkTime += workDuration;
        this.data.dailyWorkTime += workDuration;
        this.data.startTime = Date.now();
        this.saveData();
        // Sync to Firebase if user is logged in
        this.syncToFirebase();
        // Log to confirm tracking is active
        console.log('⏱️ Tracking active - Daily time:', 
          Math.round(this.data.dailyWorkTime / 1000 / 60), 'minutes');
      } else if (this.data.isWorking && !this.isSystemActive) {
        // Stop tracking only if system becomes inactive (sleep/lock)
        this.pauseTracking();
      }
    }, 5000); // 5 seconds

    // Also sync every 30 seconds regardless of work status for real-time updates
    setInterval(() => {
      if (this.data.userId && this.data.dailyWorkTime > 0) {
        this.syncToFirebase();
      }
    }, 30000); // 30 seconds

    // Set idle detection interval (30 minutes / 1800 seconds of inactivity)
    chrome.idle.setDetectionInterval(1800);
  }

  private resetDailyIfNeeded() {
    const today = new Date().toDateString();
    if (this.data.lastResetDate !== today) {
      this.data.dailyWorkTime = 0;
      this.data.lastResetDate = today;
      this.saveData();
      // Sync to Firebase if user is logged in
      this.syncToFirebase();
      
      // Reset streaks for users who haven't achieved their goal
      this.resetStreaksForInactiveUsers();
    }
  }

  private async resetStreaksForInactiveUsers() {
    try {
      // Import the Firebase service dynamically to avoid circular dependencies
      const { DailyStatsService } = await import('../services/firebase');
      await DailyStatsService.resetStreakForInactiveUsers();
      console.log('Daily streak reset completed');
    } catch (error) {
      console.error('Failed to reset streaks for inactive users:', error);
    }
  }

  private async syncToFirebase() {
    if (!this.data.userId) {
      return; // No user logged in
    }

    try {
      // Send message to popup to sync daily stats (only if popup is open)
      chrome.runtime.sendMessage({
        action: 'syncDailyStats',
        userId: this.data.userId,
        dailyWorkTime: this.data.dailyWorkTime
      }).catch(() => {
        // Ignore errors if popup is not open
        console.log('Popup not open, skipping sync message');
      });
    } catch (error) {
      console.error('Failed to sync to Firebase:', error);
    }
  }


  private async handleMessage(request: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) {
    try {
      switch (request.action) {
        case 'pageVisible':
          // Page became visible, check if it's a work site
          if (request.url) {
            this.checkWorkSite(request.url);
          }
          sendResponse({ success: true });
          break;
        
        case 'pageHidden':
          // Page became hidden, but don't pause if it's just the popup being opened
          // Only pause if the user actually navigated away or switched tabs
          if (request.reason === 'navigation' || request.reason === 'tab_switch') {
            this.pauseTracking();
          }
          sendResponse({ success: true });
          break;
        
        case 'userActivity':
          // User is active on the page
          this.isUserActive = true;
          this.lastActivityTime = Date.now();
          if (request.url) {
            this.checkWorkSite(request.url);
          }
          sendResponse({ success: true });
          break;
        
        case 'getWorkTime':
          sendResponse({ 
            workTime: this.data.currentWorkTime,
            dailyWorkTime: this.data.dailyWorkTime,
            isWorking: this.data.isWorking
          });
          break;
        
        case 'getWorkSites':
          sendResponse({ workSites: this.data.workSites });
          break;
        
        case 'addWorkSite':
          if (request.site && !this.data.workSites.includes(request.site)) {
            try {
              // Add the site
              this.data.workSites.push(request.site);
              await this.saveData();
              
              // Register content script for this site
              await this.registerContentScriptForSite(request.site);
              
              sendResponse({ success: true });
            } catch (error) {
              console.error('Error adding work site:', error);
              // Remove the site if registration failed
              this.data.workSites = this.data.workSites.filter(s => s !== request.site);
              await this.saveData();
              sendResponse({ success: false, error: 'Failed to register permissions' });
            }
          } else {
            sendResponse({ success: false, error: 'Site already exists or invalid' });
          }
          break;
        
        case 'removeWorkSite':
          try {
            this.data.workSites = this.data.workSites.filter(site => site !== request.site);
            await this.saveData();
            
            // Unregister content script for this site
            const scriptId = `lockedin-${request.site.replace(/\./g, '-')}`;
            await chrome.scripting.unregisterContentScripts({ ids: [scriptId] });
            console.log('🗑️ Unregistered content script for:', request.site);
            
            sendResponse({ success: true });
          } catch (error) {
            console.error('Error removing work site:', error);
            sendResponse({ success: false, error: 'Failed to unregister' });
          }
          break;
        
        case 'getStatus':
          sendResponse({
            isWorking: this.data.isWorking,
            workSites: this.data.workSites,
            dailyWorkTime: this.data.dailyWorkTime
          });
          break;
        
        case 'setUserId':
          this.data.userId = request.userId;
          await this.saveData();
          sendResponse({ success: true });
          break;
        
        case 'getUserId':
          sendResponse({ userId: this.data.userId });
          break;
        
        case 'syncToFirebase':
          this.syncToFirebase();
          sendResponse({ success: true });
          break;
        
        default:
          sendResponse({ error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({ error: 'Internal error' });
    }
  }
}

// Initialize the work tracker
new WorkTracker();
