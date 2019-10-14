# Markdown Guide

Markdown is a simple way to format text that looks great on any device. It doesn't do anything fancy like change the font size, color, or type — just the essentials, using keyboard symbols you already know. Since it is plain text, it is an easy way to author notes and documents and when needed it can be converted to a rich text HTML document.

Joplin desktop and mobile applications can display both the Markdown text and the rendered rich text document.

## Cheat Sheet

This is a quick summary of the Markdown syntax.

|     | Markdown | Rendered Output
| --- | --- | ---
| **Heading 1** | <pre># Heading 1</pre> | <h1>Heading 1</h1>
| **Heading 2** | <pre>## Heading 2</pre> | <h2>Heading 2</h2>
| **Heading 3** | <pre>### Heading 3</pre> | <h3>Heading 3</h3>
| **Bold** | <pre>This is some `**bold text**`</pre> | This is some <strong>bold text</strong>
| **Italic** | <pre>This is some `*italic text*`</pre> | This is some <i>italic text</i>
| **Blockquotes** | <pre>> Kent.<br/>> Where's the king?<br/><br/>> Gent.<br/>> Contending with the<br/>> fretful elements</pre> | <blockquote>Kent.<br/>Where's the king?<br/><br/>Gent.<br/>Contending with<br/>the fretful elements</blockquote>
| **List** | <pre>* Milk<br/>* Eggs<br/>* Beers<br/>    * Desperados<br/>    * Heineken<br/>* Ham</pre> | <ul><li>Milk</li><li>Eggs</li><li>Beers<ul><li>Desperados</li><li>Heineken</li></ul></li><li>Ham</li></ul>
| **Ordered list** | <pre>1. Introduction<br/>2. Main topic<br/>    1. First sub-topic<br/>    2. Second sub-topic<br/>3. Conclusion</pre> | <ol><li>Introduction</li><li>Main topic<ol><li>First sub-topic</li><li>Second sub-topic</li></ol></li><li>Conclusion</li></ol>
| **Inline code** | <pre>This is \`someJavaScript()\`</pre> | This is `someJavaScript()`
| **Code block** | <pre>Here's some JavaScript code:<br><br>\`\`\`<br>function hello() {<br>    alert('hello');<br>}<br>\`\`\`<br><br>Language is normally auto-detected,<br>but it can also be specified:<br><br>\`\`\`sql<br>SELECT * FROM users;<br>DELETE FROM sessions;<br>\`\`\`</pre> | Here's some JavaScript code:<br><br><pre>function hello() {<br>&nbsp;&nbsp;&nbsp;&nbsp;alert('hello');<br>}</pre><br>Language is normally auto-detected, but it can also be specified:<br><br><pre>SELECT * FROM users;<br>DELETE FROM sessions;</pre>
| **Unformatted text** | <pre>Indent with a tab or 4 spaces<br>for unformatted text.<br/><br/>    This text will not be formatted:<br><br>    Robert'); DROP TABLE students;--</pre> | Indent with a tab or 4 spaces for unformatted text.<br><br><pre>This text will not be formatted:<br><br>Robert'); DROP TABLE students;--</pre>
| **Link** | <pre>This is detected as a link:<br><br>`https://joplinapp.org`<br><br>And this is a link with a title:<br><br>`[Joplin](https://joplinapp.org)`</pre> | This is detected as a link:<br><br>https://joplinapp.org<br><br>And this is a link with a title:<br><br>[Joplin](https://joplinapp.org)
| **Images** | <pre>`![Joplin icon](https://git.io/JenGk)`</pre> | ![Here's Joplin icon](https://git.io/JenGk)
| **Horizontal Rule** | <pre>One rule:<br>\*\*\*<br>Another rule:<br>\-\-\-</pre> | One rule:<hr><br>Another rule:<br><hr>
| **Tables** | [See below](#tables) | 

### Tables

Tables are created using pipes `|` and and hyphens `-`. This is a Markdown table:

	| First Header  | Second Header |
	| ------------- | ------------- |
	| Content Cell  | Content Cell  |
	| Content Cell  | Content Cell  |

Which is rendered as:

| First Header  | Second Header |
| ------------- | ------------- |
| Content Cell  | Content Cell  |
| Content Cell  | Content Cell  |

Note that there must be at least 3 dashes separating each header cell.

Colons can be used to align columns:

	| Tables        | Are           | Cool  |
	| ------------- |:-------------:| -----:|
	| col 3 is      | right-aligned | $1600 |
	| col 2 is      | centered      |   $12 |

Which is rendered as:

| Tables        | Are           | Cool  |
| ------------- |:-------------:| -----:|
| col 3 is      | right-aligned | $1600 |
| col 2 is      | centered      |   $12 |

## Joplin Extras

Besides the standard Mardkown syntax, Joplin supports several additional features.

### Links to other notes

You can create a link to a note by specifying its ID in the URL. For example:

	[Link to my note](:/0b0d62d15e60409dac34f354b6e9e839)

Since getting the ID of a note is not straightforward, each app provides a way to create such link. In the **desktop app**, right click on a note an select "Copy Markdown link". In the **mobile app**, open a note and, in the top right menu, select "Copy Markdown link". You can then paste this link anywhere in another note.

### Math notation

Math expressions can be added using the [KaTeX notation](https://khan.github.io/KaTeX/). To add an inline equation, wrap the expression in `$EXPRESSION$`, eg. `$\sqrt{3x-1}+(1+x)^2$`. To create an expression block, wrap it as follow:

	$$
	EXPRESSION
	$$

For example:

	$$
	f(x) = \int_{-\infty}^\infty
		\hat f(\xi)\,e^{2 \pi i \xi x}
		\,d\xi
	$$

Here is an example with the Markdown and rendered result side by side:

<img src="https://joplinapp.org/images/Katex.png" height="345px">

### Chemical equations

Joplin supports chemical equations via the mhchem plugin for KaTeX. This plugin is automatically enabled if you enable math notation. See the [mhchem documentation](https://mhchem.github.io/MathJax-mhchem/) for the syntax.

<img src="https://joplinapp.org/images/Katex_mhchem.png" height="196px">

### Checkboxes

Checkboxes can be added like so:

	- [ ] Milk
	- [ ] Rice
	- [ ] Eggs

The checkboxes can then be ticked in the mobile and desktop applications.

### HTML support

It is generally recommended to enter the notes as Markdown as it makes the notes easier to edit. However for cases where certain features aren't supported (such as strikethrough or to highlight text), you can also use HTML code directly. For example this would be a valid note:

	This is <s>strikethrough text</s> mixed with regular **Markdown**.

### Plugins

Joplin supports a number of plugins that can be toggled on top the standard Markdown features you would expect. These toggle-able plugins are listed below. Note: not all of the plugins are enabled by default, if the enable field is 'no' below, then open the option screen to enable the plugin. Plugins can be disabled in the same manner.

| Plugin | Syntax | Description | Enabled |
|--------|--------|-------------|---------|
| [Katex](https://katex.org) | `$$math expr$$` or `$math$` | [See above](#math-notation) | yes |
| [Mark](https://github.com/markdown-it/markdown-it-mark) | `==marked==` | Transforms into `<mark>marked</mark>` (highlighted) | yes |
| [Footnote](https://github.com/markdown-it/markdown-it-footnote) | `Simples inline footnote ^[I'm inline!]` | See [plugin page](https://github.com/markdown-it/markdown-it-footnote) for full description | yes |
| [TOC](https://github.com/nagaozen/markdown-it-toc-done-right) | Any of `${toc}, [[toc]], [toc], [[_toc_]]` | Adds a table of contents to the location of the toc page. Based on headings and sub-headings | no |
| [Sub](https://github.com/markdown-it/markdown-it-sub) | `X~1~` | Transforms into X<sub>1</sub> | no |
| [Sup](https://github.com/markdown-it/markdown-it-sup) | `X^2^` | Transforms into X<sup>2</sup> | no |
| [Deflist](https://github.com/markdown-it/markdown-it-deflist) | See [pandoc](http://johnmacfarlane.net/pandoc/README.html#definition-lists) page for syntax | Adds the html `<dl>` tag accessible through markdown | no |
| [Abbr](https://github.com/markdown-it/markdown-it-abbr) | *[HTML]: Hyper Text Markup Language | Allows definition of abbreviations that can be hovered over later for a full expansion | no |
| [Emoji](https://github.com/markdown-it/markdown-it-emoji) | `:smile:` :smile: | See [this list](https://gist.github.com/rxaviers/7360908) for more emoji | no |
| [Insert](https://github.com/markdown-it/markdown-it-ins) | `++inserted++` | Transforms into `<ins>inserted</ins>` (<ins>inserted</ins>) | no |
| [Multitable](https://github.com/RedBug312/markdown-it-multimd-table) | See [MultiMarkdown](https://fletcher.github.io/MultiMarkdown-6/syntax/tables.html) page | Adds more power and customization to markdown tables | no |
| [Fountain](https://fountain.io) | <code>\`\`\`fountain</code><br/>Your screenplay...<br/><code>\`\`\`</code> | Adds support for the Fountain markup language, a plain text markup language for screenwriting | no |
