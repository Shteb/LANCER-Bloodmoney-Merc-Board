// File-backed express-session store.
//
// The default express-session MemoryStore lives only in the Node process's
// RAM, so every login is forgotten the moment the process restarts -- an
// Azure idle-timeout recycle, a crash, or a redeploy all instantly log out
// every signed-in user (admin and players alike), which looks like a random
// logout to whoever happens to touch the app right after. This store writes
// sessions to a JSON file next to the rest of this app's data, so logins
// survive a process restart as long as that file survives it.
const fs = require('fs');
const session = require('express-session');

class FileSessionStore extends session.Store {
  constructor(filePath) {
    super();
    this.filePath = filePath;
    this.sessions = this._read();
  }

  _read() {
    try {
      return JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
    } catch (err) {
      return {};
    }
  }

  _write() {
    fs.writeFileSync(this.filePath, JSON.stringify(this.sessions));
  }

  _prune() {
    const now = Date.now();
    for (const sid of Object.keys(this.sessions)) {
      if (this.sessions[sid].expires < now) {
        delete this.sessions[sid];
      }
    }
  }

  _expiryOf(sessionData) {
    return sessionData.cookie && sessionData.cookie.expires
      ? new Date(sessionData.cookie.expires).getTime()
      : Date.now() + 24 * 60 * 60 * 1000;
  }

  get(sid, callback) {
    this._prune();
    const entry = this.sessions[sid];
    callback(null, entry ? entry.data : null);
  }

  set(sid, sessionData, callback) {
    this.sessions[sid] = { data: sessionData, expires: this._expiryOf(sessionData) };
    this._prune();
    this._write();
    if (callback) callback();
  }

  destroy(sid, callback) {
    delete this.sessions[sid];
    this._write();
    if (callback) callback();
  }

  touch(sid, sessionData, callback) {
    const entry = this.sessions[sid];
    if (entry) {
      entry.data = sessionData;
      entry.expires = this._expiryOf(sessionData);
      this._write();
    }
    if (callback) callback();
  }
}

module.exports = FileSessionStore;
