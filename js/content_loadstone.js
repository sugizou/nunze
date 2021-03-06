function initialize_nunze_loadstone_content_script() {
  'use strict';
  //
  // Message listeners
  //
  chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    if (message.method === 'Nunze_LoadInventory') {
      const inv = loadInventory();
      if (! inv) {
        failAlertInv();
        return;
      }
      chrome.runtime.sendMessage({
        'method': 'Nunze_saveInventories',
        'inventories': [inv],
        'inCrawling': true
      }, function(response){
        if (! response || ! response.status || response.status == 'fail') {
          failAlertInv();
        } else if (response.status == 'completed') {
          alert('[Nunze]リテイナー所持品情報を保存しました。');
        }
      });
    } else {
      sendResponse({});
    }
  });
  function failAlertInv() {
    alert('[Nunze]リテイナー所持品情報の保存に失敗しました。\n' +
      'ページを更新して再度試してみてください。');
  }
  //
  // Load data
  //
  function loadInventory(){
    const m = window.location.href.match(REGX_BAGGAGE);
    if (!m) return null;
    return {
      character_id: m[1],
      retainer_id: m[2],
      load_datetime: (new Date()).getTime(),
      items: getItems()
    };
  }
  function loadInventories() {
    const ans = window.confirm('[Nunze]リテイナー情報を読み取るため、自動でページが遷移します。\n' +
      'よろしいですか？');
    if (! ans) return;
    // save character data
    const chara = getCharacter();
    chara.retainers = getRetainers();
    chara.load_datetime = (new Date()).getTime();
    chrome.runtime.sendMessage({
      'method': 'Nunze_saveCharacters',
      'characters': [chara]
    }, function(response){
      if (! response || ! response.succeed) {
        alert('[Nunze]キャラクター情報の保存に失敗しました。\n' +
          'ページを更新して再度試してみてください。');
        return;
      }
      chrome.runtime.sendMessage({
        'method': 'Nunze_startRetainerCrawler',
        'character': chara
      });
    });
  }
  //
  // Load data (parse pages)
  //
  const REGX_CHARACTER = /character\/([0-9a-z]+)/;
  const REGX_RETAINER = /character\/([0-9a-z]+)\/retainer/;
  const REGX_RETAINERS = /.*\/retainer\/([0-9a-zA-Z]+).*/;
  const REGX_BAGGAGE = /character\/([0-9a-z]+)\/retainer\/([0-9a-z]+)\/baggage/;
  const REGX_STRIP = /^[\t\s\r\n]*(.*?)[\t\s\r\n]*$/;
  const forEach = Array.prototype.forEach;
  function buildRetainerUrl(chara, retainer) {
    return 'http://jp.finalfantasyxiv.com/lodestone/character/' +
      chara.id + '/retainer/' + (retainer ? retainer.id : '');
  }
  // Load Character
  function getCharacter(charabox) {
    if (! charabox) charabox = document.querySelector('div.head-my-character__box');
    const li = charabox.querySelector('ul.my-menu__colmun li');
    if (! li) return null;
    const a = li.querySelectorAll('a')[1];
    if (! a) return null;
    const m = a.href.match(REGX_CHARACTER);
    if (! m) return null;
    const name = charabox.querySelector('span.head-my-character__name');
    const world = charabox.querySelector('span.head-my-character__worldstatus');
    return {
      id: m[1],
      name: name ? name.innerText.replace(REGX_STRIP, '$1') : '',
      world: world ? world.innerText.replace(REGX_STRIP, '$1') : ''
    };
  }
  // Load retainers
  function getRetainers() {
    const rheader = document.querySelector('.retainer__data');
    if (!rheader) return [];
    const retainers = rheader.querySelectorAll('li');
    const ret = {};
    forEach.call(retainers, function(e){
      const a = e.getElementsByTagName('a');
      if (a.length != 1) return;
      const id = a[0].href.replace(REGX_RETAINERS, '$1');
      ret[id] = { name:  a[0].innerText, id: id };
    });
    return ret;
  }
  // Load items
  function getItems() {
    const baggage = document.getElementsByClassName('sys_item_row');
    const items = [];
    forEach.call(baggage, function(e){
      const name_h4 = e.getElementsByTagName('h4');
      if (name_h4.length != 1) return;
      const link = name_h4[0].getElementsByTagName('a');
      if (link.length <= 1) return;
      const num = e.getElementsByClassName('item-list__number');
      if (num.length != 1) return;
      const i = parseInt(num[0].innerText, 10);
      if (isNaN(i)) return;
      const icon = e.getElementsByClassName('ic_item_quality');
      let isHq = false;
      let isCol = false;
      if (icon.length >= 1) {
        const u = new URL(link[0].href, window.location.href);
        if (u.search.indexOf('hq=1') >= 0) {
          isHq = true;
        } else {
          isCol = true;
        }
      }
      items.push({
        name: link[0].innerText,
        number: i,
        HQ: isHq,
        collectable: isCol
      });
    });
    return items;
  }
  //
  // Add Nunze button
  //
  function initialize() {
    const charabox = document.querySelector('div.head-my-character__box');
    if (! charabox) return;
    const chara = getCharacter(charabox);
    if (! chara) return;
    const ul = charabox.querySelectorAll('ul.my-menu__colmun')[1];
    if (! charabox) return;
    const nunzeli = document.createElement('li');
    const nunzea = document.createElement('a');
    if (REGX_RETAINER.test(window.location.href)) {
      nunzea.innerText = '[Nunze] リテイナー情報読み取り';
      nunzea.href = '#';
      nunzea.addEventListener('click', loadInventories, false);
    } else {
      nunzea.innerText = '[Nunze] リテイナーページへ';
      nunzea.href = buildRetainerUrl(chara);
    }
    nunzeli.appendChild(nunzea);
    ul.appendChild(nunzeli);
  }
  initialize();
}

(function(){
  'use strict';
  //
  // Use Loadstone feature?
  //
  chrome.runtime.sendMessage({
    'method': 'Nunze_getOption',
  }, function(response){
    if (response.opt.data.loadstone.use)
      initialize_nunze_loadstone_content_script();
  });
})();
