'use babel';

import { CompositeDisposable } from 'atom';
import request from 'request';
import cheerio from 'cheerio';
import google from 'google';
google.resultsPerPage = 1;

export default {
  
  subscriptions: null,
  
  activate() {
    this.subscriptions = new CompositeDisposable();
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      // Ctrl+Shift+P or Cmd+Shift+P in atom to find and use the custom command sourcefetch:fetch
      'sourcefetch:fetch': () => this.fetch()
        /* call tree:
          fetch()
            --> search() --> google()
            --> download() --> request()
            --> scrape() --> cheerio.load()
        */
    }));
  },
  
  deactivate() {
    this.subscriptions.dispose();
  },
  
  fetch() {
    let self = this;
    let editor = atom.workspace.getActiveTextEditor();
    if (editor) {
      let query = editor.getSelectedText(); // treat selected text as a query
      let language = editor.getGrammar().name; // identify programming language using TextEditor API
      self.search(query, language) // use search to get a URL
        .then(url => {
          atom.notifications.addSuccess('Found Google results!');
          return self.download(url); // use download to get html in another Promise, and chain that call
        }).then(html => {
          let answer = self.scrape(html); // use scrape to get the specific html element within a div with specific class
          if (answer === '') {
            atom.notifications.addWarning('No answer found :(');
          } else {
            atom.notifications.addSuccess('Found snippet!');
            editor.insertText(answer); // paste the code (will replace the selected text)
          }
        }).catch(error => {
          console.log(error);
          atom.notifications.addWarning(error.reason);
        });
    }
  },
  
  search(query, language) {
    return new Promise((resolve, reject) => {
      let searchString = `${query} in ${language} site:stackoverflow.com`;
      google(searchString, (err, res) => {
        if (err) {
          reject({
            reason: 'A search error occured :('
          });
        } else if (res.links.length === 0) {
          reject({
            reason: 'No results found :('
          });
        } else {
          resolve(res.links[0].href);
        }
      });
    });
  },
  
  download(url) {
    return new Promise((resolve, reject) => {
      request(url, (error, response, body) => {
        if (!error && response.statusCode == 200) {
          resolve(body);
        } else {
          reject({
            reason: 'Unable to download page.'
          });
        }
      });
    });
  },
  
  scrape(html) {
    $ = cheerio.load(html);
    return $('div.accepted-answer pre code').text();
  }
  
};
