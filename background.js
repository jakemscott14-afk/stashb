chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'save-to-stashd',
      title: 'Save to Stashd',
      contexts: ['link', 'page']
    })
  })
})

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const url = info.linkUrl || info.pageUrl
  const title = tab ? tab.title || url : url

  if (!url) return

  let domain = ''
  try {
    domain = new URL(url).hostname.replace('www.', '')
  } catch (e) {}

  if (!info.linkUrl && tab && tab.id) {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: function() {
        var thumb = ''
        var desc = ''
        var dur = ''
        var ogImg = document.querySelector('meta[property="og:image"]')
        if (ogImg) thumb = ogImg.content || ''
        var metaDesc = document.querySelector('meta[name="description"]')
        if (metaDesc) desc = metaDesc.content || ''
        var video = document.querySelector('video')
        if (video && isFinite(video.duration)) {
          dur = Math.floor(video.duration/60) + ':' + Math.floor(video.duration%60).toString().padStart(2,'0')
        }
        return { thumb: thumb, desc: desc, dur: dur }
      }
    }, function(results) {
      var r = results && results[0] && results[0].result
      saveToDb(url, title, domain, r ? r.thumb : '', r ? r.desc : '', r ? r.dur : '')
    })
  } else {
    saveToDb(url, title, domain, '', '', '')
  }
})

function saveToDb(url, title, domain, thumbnail, description, duration) {
  var request = indexedDB.open('stashd', 40)

  request.onerror = function(e) {
    console.error('DB open error:', e)
  }

  request.onsuccess = function(event) {
    var db = event.target.result
    var tx = db.transaction('bookmarks', 'readwrite')
    var store = tx.objectStore('bookmarks')

    var item = {
      url: url,
      title: title,
      domain: domain,
      duration: duration,
      thumbnail: thumbnail,
      description: description,
      tags: [],
      moodTags: [],
      badges: [],
      notes: '',
      isFavorite: false,
      watchProgress: 0,
      watchCount: 0,
      lastWatched: null,
      isAlive: true,
      lastChecked: null,
      playlists: [],
      savedAt: Date.now()
    }

    var addRequest = store.add(item)

    addRequest.onsuccess = function() {
      console.log('Saved to Stashd:', url)
    }

    addRequest.onerror = function(e) {
      console.error('Save error:', e)
    }
  }
}