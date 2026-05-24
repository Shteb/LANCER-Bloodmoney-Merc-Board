// Simple mutex implementation for preventing race conditions in file operations
class FileMutex {
  constructor() {
    this.locks = new Map();
  }
  
  async acquire(key) {
    const timeoutMs = 5000; // Maximum time to wait for a lock before failing
    const start = Date.now();

    while (this.locks.get(key)) {
      if (Date.now() - start >= timeoutMs) {
        throw new Error(`Timeout while waiting to acquire file lock for key: ${key}`);
      }
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    this.locks.set(key, true);
  }
  
  release(key) {
    this.locks.delete(key);
  }
}

module.exports = new FileMutex();
