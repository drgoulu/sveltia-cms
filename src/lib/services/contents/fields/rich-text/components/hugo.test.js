import { describe, expect, it } from 'vitest';

import {
  ALL_HUGO_COMPONENTS,
  escapeHtml,
  formatHugoArgs,
  HUGO_ALTMETRIC_COMPONENT,
  HUGO_COMPONENT_NAMES,
  HUGO_DAILYMOTION_COMPONENT,
  HUGO_FIGURE_COMPONENT,
  HUGO_GENERIC_COMPONENT,
  HUGO_GIST_COMPONENT,
  HUGO_HIGHLIGHT_COMPONENT,
  HUGO_OPENBOOK_COMPONENT,
  HUGO_VIMEO_COMPONENT,
  HUGO_YOUTUBE_COMPONENT,
  parseHugoArgs,
  resolveHugoImagePath,
} from './hugo.js';

describe('hugo shortcodes utilities', () => {
  describe('parseHugoArgs', () => {
    it('handles empty or undefined string', () => {
      expect(parseHugoArgs('')).toEqual({ _raw: '' });
      expect(parseHugoArgs(undefined)).toEqual({ _raw: '' });
    });

    it('parses named arguments', () => {
      const result = parseHugoArgs('src="image.jpg" alt="Description" align="alignleft"');
      expect(result.src).toBe('image.jpg');
      expect(result.alt).toBe('Description');
      expect(result.align).toBe('alignleft');
    });

    it('parses positional arguments', () => {
      const result = parseHugoArgs('"my-video-id" "autoplay"');
      expect(result._primary).toBe('my-video-id');
      expect(result._pos_0).toBe('my-video-id');
      expect(result._pos_1).toBe('autoplay');
    });

    it('parses unquoted positional arguments', () => {
      const result = parseHugoArgs('123456');
      expect(result._primary).toBe('123456');
      expect(result._pos_0).toBe('123456');
    });
  });

  describe('formatHugoArgs', () => {
    it('formats named arguments correctly', () => {
      const str = formatHugoArgs({ src: 'foo.jpg', alt: 'bar' });
      expect(str).toContain('src="foo.jpg"');
      expect(str).toContain('alt="bar"');
    });

    it('formats positional arguments', () => {
      const str = formatHugoArgs({ _pos_0: 'id123', _pos_1: 'sample with space' });
      expect(str).toBe('id123 "sample with space"');
    });
  });

  describe('escapeHtml', () => {
    it('escapes special characters', () => {
      expect(escapeHtml('<script>alert("xss & fun")</script>')).toBe(
        '&lt;script&gt;alert(&quot;xss &amp; fun&quot;)&lt;/script&gt;',
      );
    });
  });

  describe('resolveHugoImagePath', () => {
    it('keeps absolute or remote URLs untouched', () => {
      expect(resolveHugoImagePath('https://example.com/pic.jpg')).toBe('https://example.com/pic.jpg');
      expect(resolveHugoImagePath('/posts/2012/images/pic.jpg')).toBe('/posts/2012/images/pic.jpg');
      expect(resolveHugoImagePath('blob:http://localhost/123')).toBe('blob:http://localhost/123');
    });

    it('resolves relative path', () => {
      expect(resolveHugoImagePath('images/pic.jpg')).toBe('/posts/images/pic.jpg');
      expect(resolveHugoImagePath('./images/pic.jpg')).toBe('/posts/images/pic.jpg');
    });
  });
});

describe('hugo components definitions', () => {
  it('exports all 9 components', () => {
    expect(ALL_HUGO_COMPONENTS).toHaveLength(9);
    expect(HUGO_COMPONENT_NAMES).toEqual([
      'hugo-figure',
      'hugo-youtube',
      'hugo-vimeo',
      'hugo-dailymotion',
      'hugo-openbook',
      'hugo-altmetric',
      'hugo-gist',
      'hugo-highlight',
      'hugo-generic',
    ]);
  });

  describe('hugo-figure', () => {
    const input =
      '{{< figure src="images/photo.jpg" alt="A photo" caption="Caption here" align="alignleft" width="230" >}}';

    it('matches and parses figure shortcode', () => {
      const match = input.match(HUGO_FIGURE_COMPONENT.pattern);
      expect(match).not.toBeNull();

      const props = HUGO_FIGURE_COMPONENT.fromBlock(match);
      expect(props.src).toBe('images/photo.jpg');
      expect(props.alt).toBe('A photo');
      expect(props.caption).toBe('Caption here');
      expect(props.align).toBe('alignleft');
      expect(props.width).toBe('230');

      const preview = HUGO_FIGURE_COMPONENT.toPreview(props);
      expect(preview).toContain('<figure class="alignleft"');
      expect(preview).toContain('src="/posts/images/photo.jpg"');
      expect(preview).toContain('max-width: 230px;');
      expect(preview).toContain('<figcaption');
    });
  });

  describe('hugo-youtube', () => {
    const input = '{{< youtube "dF-KhAXbV8k" >}}';

    it('matches and previews youtube', () => {
      const match = input.match(HUGO_YOUTUBE_COMPONENT.pattern);
      expect(match).not.toBeNull();

      const props = HUGO_YOUTUBE_COMPONENT.fromBlock(match);
      expect(props._primary).toBe('dF-KhAXbV8k');

      const preview = HUGO_YOUTUBE_COMPONENT.toPreview(props);
      expect(preview).toContain('youtube-nocookie.com/embed/dF-KhAXbV8k');
    });
  });

  describe('hugo-vimeo', () => {
    const input = '{{< vimeo "12345678" >}}';

    it('matches and previews vimeo', () => {
      const match = input.match(HUGO_VIMEO_COMPONENT.pattern);
      expect(match).not.toBeNull();

      const props = HUGO_VIMEO_COMPONENT.fromBlock(match);
      const preview = HUGO_VIMEO_COMPONENT.toPreview(props);
      expect(preview).toContain('player.vimeo.com/video/12345678');
    });
  });

  describe('hugo-dailymotion', () => {
    const input = '{{< dailymotion "x8m4abc" >}}';

    it('matches and previews dailymotion', () => {
      const match = input.match(HUGO_DAILYMOTION_COMPONENT.pattern);
      expect(match).not.toBeNull();

      const props = HUGO_DAILYMOTION_COMPONENT.fromBlock(match);
      expect(props._primary).toBe('x8m4abc');

      const preview = HUGO_DAILYMOTION_COMPONENT.toPreview(props);
      expect(preview).toContain('dailymotion.com/embed/video/x8m4abc');
      expect(HUGO_DAILYMOTION_COMPONENT.toBlock({ id: 'x8m4abc' })).toBe('{{< dailymotion "x8m4abc" >}}');
    });

    it('extracts ID from full dailymotion URL', () => {
      const preview = HUGO_DAILYMOTION_COMPONENT.toPreview({ id: 'https://www.dailymotion.com/video/x9xyz12' });
      expect(preview).toContain('dailymotion.com/embed/video/x9xyz12');
      expect(HUGO_DAILYMOTION_COMPONENT.toBlock({ id: 'https://dai.ly/x9xyz12' })).toBe('{{< dailymotion "x9xyz12" >}}');
    });
  });

  describe('hugo-openbook', () => {
    const input = '{{< openbook "2880746162" "simple" >}}';

    it('matches and previews openbook', () => {
      const match = input.match(HUGO_OPENBOOK_COMPONENT.pattern);
      expect(match).not.toBeNull();

      const props = HUGO_OPENBOOK_COMPONENT.fromBlock(match);
      const preview = HUGO_OPENBOOK_COMPONENT.toPreview(props);
      expect(preview).toContain('2880746162');
      expect(preview).toContain('openlibrary.org');
    });
  });

  describe('hugo-altmetric', () => {
    const input = '{{< altmetric doi="10.1038/nature.2012.9806" >}}';

    it('matches and previews altmetric', () => {
      const match = input.match(HUGO_ALTMETRIC_COMPONENT.pattern);
      expect(match).not.toBeNull();

      const props = HUGO_ALTMETRIC_COMPONENT.fromBlock(match);
      const preview = HUGO_ALTMETRIC_COMPONENT.toPreview(props);
      expect(preview).toContain('10.1038/nature.2012.9806');
    });
  });

  describe('hugo-gist', () => {
    const input = '{{< gist spf13 789640 >}}';

    it('matches and previews gist', () => {
      const match = input.match(HUGO_GIST_COMPONENT.pattern);
      expect(match).not.toBeNull();

      const props = HUGO_GIST_COMPONENT.fromBlock(match);
      const preview = HUGO_GIST_COMPONENT.toPreview(props);
      expect(preview).toContain('gist.github.com/spf13/789640');
    });
  });

  describe('hugo-highlight', () => {
    const input = '{{< highlight js >}}\nconsole.log("hello");\n{{< /highlight >}}';

    it('matches and previews highlight', () => {
      const match = input.match(HUGO_HIGHLIGHT_COMPONENT.pattern);
      expect(match).not.toBeNull();

      const props = HUGO_HIGHLIGHT_COMPONENT.fromBlock(match);
      expect(props.lang).toBe('js');
      expect(props.body).toContain('console.log("hello");');

      const preview = HUGO_HIGHLIGHT_COMPONENT.toPreview(props);
      expect(preview).toContain('<pre');
      expect(preview).toContain('console.log(&quot;hello&quot;);');
    });
  });

  describe('hugo-generic', () => {
    const input = '{{< relref "about.md" >}}';

    it('matches and previews any unknown shortcode', () => {
      const match = input.match(HUGO_GENERIC_COMPONENT.pattern);
      expect(match).not.toBeNull();

      const props = HUGO_GENERIC_COMPONENT.fromBlock(match);
      expect(props.name).toBe('relref');

      const preview = HUGO_GENERIC_COMPONENT.toPreview(props);
      expect(preview).toContain('relref');
      expect(preview).toContain('&quot;about.md&quot;');
    });

    it('has trigger none so it is excluded from the insert menu', () => {
      expect(HUGO_GENERIC_COMPONENT.trigger).toBe('none');
    });

    it('does not match known shortcodes like highlight or figure', () => {
      expect('{{< highlight bash >}}'.match(HUGO_GENERIC_COMPONENT.pattern)).toBeNull();
      expect('{{< figure src="x.jpg" >}}'.match(HUGO_GENERIC_COMPONENT.pattern)).toBeNull();
      expect('{{< youtube 12345 >}}'.match(HUGO_GENERIC_COMPONENT.pattern)).toBeNull();
      expect('{{< /highlight >}}'.match(HUGO_GENERIC_COMPONENT.pattern)).toBeNull();
    });
  });

  describe('shortcodes collapsed by default', () => {
    it('all hugo components have collapsed: true', () => {
      ALL_HUGO_COMPONENTS.forEach((comp) => {
        expect(comp.collapsed).toBe(true);
      });
    });
  });
});

