# LookListenRead

## Overview

Chrome extension to read webpages aloud. I couldn't find any extension for Chrome or Firefox, which would allow easy navigation (e.g. rewind) and highlight currently uttered piece of text. So eventually I wrote my own.

## Install

Clone the repo, or download and unpack zip from https://github.com/w3rs/LookListenRead/archive/master.zip

Go to `chrome://extensions`, check **Developer mode** checkbox on the top right, and click on **Load unpacked extension**. Then choose `LookListenRead` folder.

You need to have TTS voices installed.
With Chrome, you probably already have some preinstalled, but most of them are likely to be remote, so there will be noticeable pauses between utterances.

I use local [US English Female TTS (by Google)](https://chrome.google.com/webstore/detail/google-voice-by-google/kcnhkahnjcbndmmehfkdnkjomaanaooo?hl=en) voice for testing - you need to install it in order to use. You can select the voice in the extension options.

## Usage

Open a webpage, open context menu (right click) where you want to start reading, and select **Start speaking here** from the menu. Alternatively, enter the speaking mode with `Ctrl+Alt+s` and double click on text where you want to start. `Space` to pause/resume and `Esc` to exit the speaking mode. Double click anywhere - and it'll resume speaking from that point.

## More details

The webpage text is split into HTML text nodes, and by default text nodes are further split into sentences (using [blast.js](http://velocityjs.org/blast/)). HTML elements like bold text or hyperlinks have their own text nodes, so they are treated as separate sentences.

Then text nodes are merged into chunks with specified minimum length (configurable), to reduce amount of pauses in speech between sentences. You can navigate between chunks with `←` and `→` keys. Uttered chunk is higlighted.

Chunks are grouped into blocks, corresponding to HTML block-level elements, e.g. paragraphs. You can navigate between blocks by `↑` and `↓` arrows.

