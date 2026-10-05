// Storage bridge for the scheduler when the web app serves it (app/scheduler/route.ts
// puts this script ahead of the scheduler's own). It answers the same calls as the
// desktop app's preload bridge — load and save — so the scheduler uses its
// desktop code path unchanged, with the org's row in Postgres standing in for
// cili-scheduler-data.json. `kind: 'server'` is what tells the scheduler to word its
// messages for a shared record rather than a file, and to watch for other people's saves.
//
// Every save names the version it was based on. The server refuses one whose base is
// out of date, and the scheduler then shows its conflict banner, so two people editing
// at once can never silently overwrite each other.
(function(){
  "use strict";
  var API = '/api/schedule';
  var version = 0;          // the version this window last loaded or saved

  function signedOut(){
    // Session expired: send the whole tab (not just this frame) to sign in, then back.
    try { window.top.location.href = '/login?callbackUrl=' + encodeURIComponent('/dashboard'); } catch(e){}
  }
  function readJson(res){
    return res.json().catch(function(){ return null; }).then(function(body){
      return { status: res.status, body: body || {} };
    });
  }
  function unreachable(){ return { ok: false, error: 'the server could not be reached' }; }

  window.ciliStore = {
    kind: 'server',

    load: function(){
      return fetch(API, { credentials: 'same-origin', cache: 'no-store' }).then(readJson).then(function(r){
        if(r.status === 401){ signedOut(); return { ok: false, error: 'you are signed out' }; }
        if(!r.body.ok) return { ok: false, error: r.body.error || ('the server answered ' + r.status) };
        version = r.body.version || 0;
        return { ok: true, data: r.body.data === undefined ? null : r.body.data };
      }, unreachable);
    },

    save: function(payload, how){
      how = how || {};
      var body = JSON.stringify({ data: payload, baseVersion: version, force: !!how.force, keepOld: !!how.keepOld });
      return fetch(API, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: body,
        // lets the last save finish if the tab closes mid-write (browsers cap this at 64KB)
        keepalive: body.length < 60000
      }).then(readJson).then(function(r){
        if(r.body.ok){ version = r.body.version; return { ok: true }; }
        if(r.status === 401){ return { ok: false, error: 'you are signed out — sign in again in another tab, then try again' }; }
        if(r.body.conflict) return { ok: false, conflict: true, error: r.body.error };
        return { ok: false, error: r.body.error || ('the server answered ' + r.status) };
      }, unreachable);
    },

    // Cheap poll: has anyone saved since this window last loaded or saved?
    peek: function(){
      return fetch(API + '?peek=1', { credentials: 'same-origin', cache: 'no-store' }).then(readJson).then(function(r){
        if(!r.body.ok) return { ok: false };
        return { ok: true, changed: (r.body.version || 0) !== version, updatedBy: r.body.updatedBy || '' };
      }, function(){ return { ok: false }; });
    }
  };
})();
