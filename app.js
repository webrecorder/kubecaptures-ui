import { LitElement, html, css, unsafeCSS, styles } from 'lit-element';

import prettyBytes from 'pretty-bytes';

import allCssRaw from './assets/ui.scss';

import faDownload from '@fortawesome/fontawesome-free/svgs/solid/download.svg';
import faDelete from '@fortawesome/fontawesome-free/svgs/solid/trash-alt.svg';

import faRight from '@fortawesome/fontawesome-free/svgs/solid/angle-right.svg';
import faDown from '@fortawesome/fontawesome-free/svgs/solid/angle-down.svg';
import faRedo from '@fortawesome/fontawesome-free/svgs/solid/redo.svg';

import faCheck from '@fortawesome/fontawesome-free/svgs/solid/check-circle.svg';
import faX from '@fortawesome/fontawesome-free/svgs/solid/times-circle.svg';

const TEST_DATA = "";

// ===========================================================================
const allCss = unsafeCSS(allCssRaw);

function wrapCss(custom) {
  return [allCss, custom];
}


// ===========================================================================
class WitnessApp extends LitElement {
  constructor() {
    super();
    this.apiprefix = "";
    this.results = [];
    this.sortedResults = [];
    this.replaybase = "/replay/";

    this.extraProps = {};

    this.csrftoken = "";

    this.errorMessage = "";
  }

  static get sortKeys() {
    return [
      {
        "key": "status",
        "name": "Status",
      },
      {
        "key": "userTag",
        "name": "Label"
      },
      {
        "key": "startTime",
        "name": "Start Time"
      },
      {
        "key": "captureUrl",
        "name": "URL"
      },
      {
        "key": "size",
        "name": "Size"
      },
    ];
  }

  static get properties() {
    return {
      apiprefix: { type: String },

      results: { type: Array },
      sortedResults: { type: Array},

      extraProps: { type: Object },

      replaybase: { type: String },

      csrftoken: { type: String },

      errorMessage: { type: String }
    }
  }

  firstUpdated() {
    this.doUpdateResults();

    window.setInterval(() => {
      this.doUpdateResults();
    }, 5000);
  }

  async doUpdateResults() {
    if (!TEST_DATA) {
      let resp = await fetch(`${this.apiprefix}/captures`);
      resp = await resp.json();
      this.results = resp.jobs;
    } else {
      this.results = JSON.parse(TEST_DATA).jobs;
    }
  }

  updated(changedProperties) {
    if (changedProperties.has("results")) {
      const newProps = {};

      for (const result of this.results) {
        const key = result.jobid + "-" + result.index;
        newProps[key] = this.extraProps[key] || {};
        if (newProps[key].size) {
          result.size = newProps[key].size;
        }
      }

      this.extraProps = newProps;
    }
  }

  static get styles() {
    return wrapCss(css`
      .result:nth-child(odd) {
        background-color: #eee;
      }

      .result:nth-child(even) {
        background-color: #ddd;
      }

      .result {
        display: flex;
        width: 100%;
      }

      .results {
        max-width: unset;
        padding: 0 2.0em;
      }

      .columns {
        margin: 0px;
      }

      .sorter {
        margin-bottom: 0.5em;
        padding-right: 2.0em;
        text-align: right;
      }

      .new-capture {
        padding: 0.5em 1.5em;
        text-align: left;
      }

      .error {
        color: rgb(241, 70, 104);
        padding: 0.5em;
      }

      .submit-error {
        display: flex;
        justify-content: space-between;
      }
    `);
  }

  async onSubmit(event) {
    event.preventDefault();

    this.errorMessage = "";

    const textArea = this.renderRoot.querySelector("#urls");

    const tagField = this.renderRoot.querySelector("#tag");

    const text = textArea.value;
    const tag = tagField.value;

    const rawUrls = text.trim().split("\n");
    let urls = [];

    for (let url of rawUrls) {
      url = url.trim();
      if (!url) {
        continue;
      }
      if (!/https?:\/\/[\w]+/.exec(url)) {
        this.errorMessage = "The list above contains invalid URLs. Only http:// and https:// URLs are supported";
        return;
      }
      urls.push(url);
    }

    const res = await this.queueCapture(urls, tag);

    if (res.status === 200) {
      this.doUpdateResults();

      textArea.value = "";
    } else {
      this.errorMessage = "Sorry, an error has occured. Capture Not Started";
    }
  }

  async queueCapture(urls, tag) {
    const opts = {
      method: "POST",
      body: JSON.stringify({urls, tag}),
      headers: {"Content-Type": "application/json"}
    };

    if (this.csrftoken) {
      opts.headers["X-CSRFToken"] = this.csrftoken;
    }

    return await fetch(`${this.apiprefix}/captures`, opts);
  }

  async onDelete(event) {
    const { jobid, index } = event.detail;

    if (!jobid || !index) {
      return;
    }

    const headers = {};

    if (this.csrftoken) {
      headers["X-CSRFToken"] = this.csrftoken;
    }

    const res = await fetch(`${this.apiprefix}/capture/${jobid}/${index}`, {method: "DELETE", headers});
    if (res.status != 200) {
      this.errorMessage = "Sorry, an error has occured. Capture Not Started";
    } else {
      this.doUpdateResults();
    }
  }

  onSortChanged(event) {
    this.sortedResults = event.detail.sortedData;
  }

  async onRetry(event) {
    // requeue new the same url for another capture
    const urls = [event.target.result.captureUrl];
    const tag = event.target.result.userTag;

    const res = await this.queueCapture(urls, tag);

    if (res.status === 200) {
      this.doUpdateResults();
    } else {
      this.errorMessage = "Sorry, an error has occured. Capture Not Started";
    }
  }

  render() {
    return html`
      <div class="section new-capture">
        <form @submit="${this.onSubmit}">
          ${this.csrftoken ? html`
            <input type="hidden" name="${this.csrftoken_name}" value="${this.csrftoken}"/>` : ``}
          <div class="field">
            <label for="urls" class="label">URLs</label>
            <div class="control">
              <textarea id="urls" rows="3" required class="textarea is-link" placeholder="Enter one or more URLs on each line"></textarea>
            </div>
          </div>

          <div class="field">
            <label for="tag" class="label">Label (Optional)</label>
            <div class="control">
              <input id="tag" type="text" class="input" value="My Archive" placeholder="My Archive"/>
            </div>
          </div>

          <div class="submit-error">
            <div class="field">
              <div class="control">
                <button type="submit" class="button is-link">Capture</button>
              </div>
            </div>
            ${this.errorMessage ? html`
          <span class="error">${this.errorMessage}</span>
          ` : ``}
          </div>
        </form>
      </div>
      ${this.results.length ? html`
      <div class="sorter">
        <wr-sorter id="captures"
          .defaultKey="startTime"
          .defaultDesc="true"
          .sortKeys="${WitnessApp.sortKeys}"
          .data="${this.results}"
          @sort-changed="${this.onSortChanged}">
        </wr-sorter>
      </div>
      <div class="container results">
        ${this.sortedResults.map((res) => html`
        <div class="result fade-in">
          <witness-job-result
            @on-delete="${this.onDelete}"
            @on-retry="${this.onRetry}"
            .props="${this.extraProps[res.jobid + "-" + res.index]}"
            .result="${res}">
          </witness-job-result>
        </div>`)}
      </div>` : html`
      <i>No Available Captures Yet. Enter URLs above and click Capture to start capturing!</i>`}
    `;
  }
}

// ===========================================================================
class JobResult extends LitElement {
  constructor() {
    super();
    this.result = {};
    this.showPreview = false;
    this.isDeleting = false;
    this.key = null;
    this.size = -1;
  }

  static get properties() {
    return {
      key: { type: String },
      result: { type: Object },

      showPreview: { type: Boolean },

      isDeleting: { type: Boolean },

      size: { type: Number },

      props: { type: Object },
    }
  }

  updated(changedProperties) {
    if (changedProperties.has("props")) {
      this.showPreview = this.props.showPreview || false;
      this.isDeleting = this.props.isDeleting || false;
      this.size = this.props.size || -1;
      this.checkSize();

    } else {
      if (changedProperties.has("showPreview")) {
        this.props.showPreview = this.showPreview;
      }
      if (changedProperties.has("isDeleting")) {
        this.props.isDeleting = this.isDeleting;
      }
    }
  }

  async checkSize() {
    if (this.size >= 0 || this.result.status !== "Complete") {
      return;
    }

    const res = await fetch(this.result.accessUrl, {method: "HEAD"});

    if (res.status === 200) {
      this.props.size = Number(res.headers.get("Content-Length"));
      this.result.size = this.props.size;
      this.size = this.props.size;
    }
  }

  static get styles() {
    return wrapCss(css`
      :host {
        height: 100%;
        width: 100%;
        display: flex;
        flex-direction: column;
        padding-bottom: 0.5em;
      }

      .columns {
        width: 100%;
        margin: 0px;
        max-width: unset;
      }

      replay-web-page {
        height: 500px;
        width: 100%;
        display: flex;
        border: 1px solid black;
      }

      .preview {
        margin: 0 1.0em 1.0em 1.0em;
      }

      .column {
        padding: 1.0em;
        text-align: left;
      }

      .column.clip {
        text-overflow: ellipsis;
        overflow: hidden;
      }

      .column.controls {
        display: flex;
        flex-direction: row;
        justify-content: flex-start;
      }

      .column.controls.success {
        justify-content: space-around;
      }

      fa-icon {
        margin: 0 8px;
      }

      .is-loading {
        background: initial;
        border: none;
        height: 1.0em;
      }

      .in-progress {
        margin: 0 35px 0 0;
        display: inline-block;
        vertical-align: middle;
      }

      .button.is-loading::after {
        border-color: transparent transparent grey grey !important;
      }

      .checkbox {
        margin-top: 1.0em;
      }

      .minihead {
        font-size: 10px;
        font-weight: bold;
      }

      .preview-toggle {
        line-height: 1.5em;
        display: flex;
        margin-left: 0.5em;
        color: #77AE3A;
      }

      .retry {
        color: black;
      }

      .preview-toggle fa-icon {
        margin: 0px;
        margin-top: -2px;
      }

      .check {
        color: #77AE3A;
      }

      .failed {
        color: rgb(241, 70, 104);
      }

      .deleter {
        vertical-align: middle;
        color: rgb(241, 70, 104);
      }
    `);
  }

  renderStatus() {
    switch (this.result.status) {
      case "Complete":
        return html`
        <p>
          <fa-icon class="check" .svg="${faCheck}" aria-hidden="true"></fa-icon>
          <span class="is-sr-only">Complete</span>
        </p>`;

      case "In progress":
        return html`
        <p>
          <span class="is-loading button in-progress" aria-hidden="true"></span>
          <span class="is-sr-only">In Progress</span>
        </p>`;

      case "Failed":
        return html`
        <p>
          <fa-icon class="failed" .svg="${faX}" aria-hidden="true"></fa-icon>
          <span class="is-sr-only">Failed</span>
        </p>`;
    }
  }

  renderControls() {
    return html`
      ${!this.isDeleting ? html`
        <a role="button" @click="${this.onDelete}" aria-label="Delete Capture" title="Delete Capture" class="deleter">
          <fa-icon .svg="${faDelete}" aria-hidden="true"></fa-icon>
        </a>` :  html`
        <span class="is-loading button" aria-hidden="true"></span>
        <span class="is-sr-only">Deletion In Progress</span>
      `}

      ${this.result.status !== "In progress" ? html`
      <a role="button" @click="${this.onRetry}" aria-label="Retry Capture" title="Retry Capture" class="retry">
        <fa-icon .svg="${faRedo}" aria-hidden="true"></fa-icon>
      </a>` : ``}

      ${this.result.status === "Complete" ? html`
      <a href="${this.result.accessUrl}" class="download" aria-label="Download Capture" title="Download Capture">
        <fa-icon .svg="${faDownload}" aria-hidden="true"></fa-icon>
      </a>
      <a role="button" class="preview-toggle" @click="${this.onTogglePreview}" aria-label="Preview Capture" aria-expanded="${this.showPreview}">
        <span class="is-hidden-tablet preview-text" aria-hidden="true">Preview</span>
        <fa-icon size="1.5em" .svg="${this.showPreview ? faDown : faRight}" aria-hidden="true"></fa-icon>
      </a>`: ``}
    `;
  }

  render() {
    const tag = this.result.userTag || this.result.jobid;

    return html`
      <div class="columns" @dblclick="${this.onTogglePreview}">
        <div class="column is-1">
          <p class="minihead">Status</p>
          ${this.renderStatus()}
        </div>
        <div class="column clip is-2">
          <p class="minihead">Label</p>
          <p>${tag}</p>
        </div>
        <div class="column is-3">
          <p class="minihead">Start Date</p>
          ${new Date(this.result.startTime).toLocaleString()}
        </div>
        <div class="column clip">
          <p class="minihead">URL</p>
          <p class="url">${this.result.captureUrl}</p>
        </div>
        <div class="column is-1">
          <p class="minihead">Size</p>
          <p>${this.size >= 0 ? prettyBytes(this.size) : html`
            <span aria-hidden="true">-</span><span class="is-sr-only">0</span>`}
          </p>
        </div>
        <div class="column controls ${this.result.status === "Complete" ? "success" : ""} is-2">
          ${this.renderControls()}
        </div>
      </div>
      ${this.showPreview ? html`
      <div class="preview">
        <replay-web-page
          source="${this.result.accessUrl}"
          url="${this.result.captureUrl}"></replay-web-page>
      </div>
      ` : html``}

    `;
  }

  onTogglePreview(event) {
    event.preventDefault();
    event.stopPropagation();
    this.showPreview = !this.showPreview;
  }

  onDelete(event) {
    const detail = this.result;
    this.isDeleting = true;

    this.dispatchEvent(new CustomEvent("on-delete", {detail}));
  }

  onRetry(event) {
    this.dispatchEvent(new CustomEvent("on-retry"));
  }
}

customElements.define('witness-app', WitnessApp);
customElements.define('witness-job-result', JobResult);
