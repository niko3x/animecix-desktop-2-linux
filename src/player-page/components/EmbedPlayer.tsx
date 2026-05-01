import { useCallback, useEffect, useRef } from 'react';
import {
  MediaPlayer,
  MediaProvider,
  Track,
  LibASSTextRenderer,
  type MediaPlayerInstance,
} from '@vidstack/react';
import {
  DefaultVideoLayout,
  defaultLayoutIcons,
} from '@vidstack/react/player/layouts/default';

import { turkishTranslations } from './translations';
import { SkipButton } from './SkipButton';
import { NavigationButtons } from './NavigationButtons';
import { useVideoData } from '../hooks/useVideoData';
import { useParentMessages, postToParent } from '../hooks/useParentMessages';
import type { Video, SkipMeta } from '../types';
import { useColorExtraction } from '../hooks/useColorExtraction';
import './EmbedPlayer.css';

const regionNamesInTurkish = new Intl.DisplayNames(['tr'], {
  type: 'language',
});

const isIOS =
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function parseIdFromPath(): string {
  // Support /embed/:id and /embed-2/:id path formats
  const segments = window.location.pathname.split('/').filter(Boolean);
  return segments[segments.length - 1] || '';
}

function parseVidFromSearch(): string | undefined {
  const params = new URLSearchParams(window.location.search);
  return params.get('vid') || undefined;
}

export function EmbedPlayer() {
  const id = parseIdFromPath();
  const vid = parseVidFromSearch();

  const playerRef = useRef<MediaPlayerInstance>(null);
  const readyFiredRef = useRef(false);
  const pendingVideoChange = useRef(false);

  const { data, meta, loading, fetchVideo, setPrefetchedData } = useVideoData(id, vid);
  const canvasRef = useColorExtraction();

  // changeVideo: reset time to 0 first, then fetch new video
  const changeVideo = useCallback(
    (videoId: string, videoVid?: string) => {
      const player = playerRef.current;
      if (player) {
        player.currentTime = 0;
      }
      readyFiredRef.current = false;
      pendingVideoChange.current = true;
      fetchVideo(videoId, videoVid);
    },
    [fetchVideo]
  );

  // Read preferred language from localStorage as fast default
  // Note: 'prefered_language' is the tau-website spelling — kept for compatibility
  const preferredLang = localStorage.getItem('prefered_language') || 'tr';

  const tracks = (data?.subs || []).map((sub) => ({
    kind: 'subtitles' as const,
    label: regionNamesInTurkish.of(sub.language) + ' - ' + sub.name,
    src: isIOS ? 'https://tau-video.xyz/vtt/' + sub.id : sub.url,
    language: sub.language,
    type: (isIOS ? 'vtt' : 'ass') as 'vtt' | 'ass',
  }));

  // Register LibASSTextRenderer on non-iOS platforms only
  useEffect(() => {
    if (isIOS) return;

    const player = playerRef.current;
    if (!player) return;

    const renderer = new LibASSTextRenderer(() => import('jassub') as never, {
      workerUrl: '/jassub/jassub-worker.js',
      wasmUrl: '/jassub/jassub-worker.wasm',
      prescaleFactor: 1 / window.devicePixelRatio,
      defaultFont: 'Caladea',
    } as never);

    player.textRenderers.add(renderer);

    return () => {
      player.textRenderers.remove(renderer);
    };
  }, []);

  // Handle changeSub from parent iframe (animecix.tv bridge for SQLite preference)
  const changeSub = useCallback(
    (index: number) => {
      const player = playerRef.current;
      if (!player) return;

      const textTracks = player.textTracks.toArray();
      // Disable all subtitle/caption tracks first
      for (const t of textTracks) {
        if (t.kind === 'subtitles' || t.kind === 'captions') {
          t.mode = 'disabled';
        }
      }

      // index 0 means off, 1-based for subs
      if (index >= 1 && index <= tracks.length) {
        const target = textTracks.find(
          (t) =>
            (t.kind === 'subtitles' || t.kind === 'captions') &&
            t.src === tracks[index - 1].src
        );
        if (target) {
          target.mode = 'showing';
          // Update localStorage cache to match SQLite-loaded preference
          localStorage.setItem('prefered_language', tracks[index - 1].language);
          postToParent('captionsChanged', { track: index });
        }
      }
    },
    [tracks]
  );

  // Handle pre-fetched video data from desktop app (fast path)
  const onInitVideoData = useCallback((video: Video, skipMeta: SkipMeta | null) => {
    setPrefetchedData(video, skipMeta);
  }, [setPrefetchedData]);

  // Parent message handler
  const { navInfo } = useParentMessages(playerRef, changeSub, changeVideo, onInitVideoData);

  // Report caption changes to parent (when user manually changes subtitles in player UI)
  // This triggers animecix.tv to persist the preference to SQLite via IPC
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    function onTextTrackChange() {
      const active = player!.textTracks.toArray().find(
        (t) =>
          (t.kind === 'subtitles' || t.kind === 'captions') &&
          t.mode === 'showing'
      );
      if (active) {
        const idx = tracks.findIndex((t) => t.src === active.src);
        if (idx !== -1) {
          // Update local cache
          localStorage.setItem('prefered_language', tracks[idx].language);
          // Notify parent (animecix.tv) to persist to SQLite via IPC
          postToParent('captionsChanged', { track: idx + 1 });
        }
      }
    }

    player.textTracks.addEventListener('mode-change', onTextTrackChange);
    return () => {
      player.textTracks.removeEventListener('mode-change', onTextTrackChange);
    };
  }, [tracks]);

  // Disable context menu (prevents video URL exposure — T-02-12)
  useEffect(() => {
    document.oncontextmenu = (e) => e.preventDefault();
  }, []);

  // Build sources
  let sources: unknown = undefined;
  if (data) {
    if (data.hls) {
      sources = { src: data.hls, type: 'application/x-mpegurl' };
    } else if (data.urls.length > 0) {
      sources = data.urls.map((item) => {
        const height = parseInt(item.label.replace('p', ''));
        const width = Math.floor((data.ratio || 16 / 9) * height);
        return {
          src: item.url,
          height,
          width,
          type: 'video/mp4',
          bitrate: (8 * item.size) / (data.duration || 1),
          codec: 'h264',
        };
      });
    }
  }

  // Event handlers
  function onCanPlay() {
    try {
      playerRef.current?.play().catch(() => {});
    } catch {}

    postToParent('canPlay', { first: !readyFiredRef.current });

    if (!readyFiredRef.current) {
      postToParent('getCurrentTime');
    }
    readyFiredRef.current = true;
  }

  function onEnded() {
    postToParent('ended');
  }

  function onPlay() {
    postToParent('play');
  }

  function onPause() {
    postToParent('pause');
  }

  if (loading) {
    return (
      <div className="loading">
        <div className="loadingio-spinner-rolling">
          <div className="ldio-spinner">
            <div></div>
          </div>
        </div>
      </div>
    );
  }

  if (!data || (!data.hls && data.urls.length === 0)) {
    return (
      <div className="encoding">
        <div>
          <h1 style={{ textAlign: 'center' }}>Video işleniyor</h1>
          <p>
            Bu işlem biraz zaman alabilir. Lütfen daha sonra tekrar deneyiniz.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <MediaPlayer
        ref={playerRef}
        src={sources as never}
        autoPlay
        playsInline
        crossOrigin="anonymous"
        storage="tau-video"
        duration={data.duration}
        load="eager"
        onCanPlay={onCanPlay}
        onEnded={onEnded}
        onPlay={onPlay}
        onPause={onPause}
        onFullscreenChange={(isFullscreen: boolean) => {
          postToParent(isFullscreen ? 'enterFullscreen' : 'exitFullscreen');
        }}
        style={{ height: '100vh' }}
      >
        <MediaProvider>
          {tracks.map((track, i) => (
            <Track
              key={String(i)}
              src={track.src}
              kind={track.kind}
              label={track.label}
              language={track.language}
              default={track.language === preferredLang}
              type={track.type}
            />
          ))}
        </MediaProvider>
        <DefaultVideoLayout
          icons={defaultLayoutIcons}
          translations={turkishTranslations}
          thumbnails={'https://tau-video.xyz/preview/' + id}
          playbackRates={[0.5, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 3.5, 4]}
        />
        <SkipButton meta={meta} />
        {navInfo && (
          <NavigationButtons
            hasNext={navInfo.hasNext}
            hasPrev={navInfo.hasPrev}
          />
        )}
      </MediaPlayer>

      <canvas
        ref={canvasRef}
        width={500}
        height={500}
        style={{ display: 'none' }}
      />
    </>
  );
}
