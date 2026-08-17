import * as React from "react"
import { useSize } from "@/hooks/use-size"
import { cn } from "@/lib/utils"
import {
  buildSrcSet,
  buildTransformUrl,
  DEFAULT_TRANSFORM_WIDTH,
  getOriginalImageUrl,
  IMAGE_LOAD_MODE,
  nextImageLoadMode,
  parseWixMediaUrl,
} from "./image-helpers"

const LOCAL_IMAGE_WIDTHS = [320, 640, 960, 1440, 1920]
const MAX_CONCURRENT_IMAGE_LOADS = 2
const imageLoadQueue = []
let activeImageLoads = 0
let imageLoadSequence = 0

const priorityValue = { low: 0, auto: 1, high: 2 }

function pumpImageLoadQueue() {
  imageLoadQueue.sort((left, right) => right.priority - left.priority || left.sequence - right.sequence)
  while (activeImageLoads < MAX_CONCURRENT_IMAGE_LOADS && imageLoadQueue.length) {
    const task = imageLoadQueue.shift()
    if (task.cancelled) continue

    activeImageLoads += 1
    task.started = true
    let released = false
    task.release = () => {
      if (released) return
      released = true
      activeImageLoads = Math.max(0, activeImageLoads - 1)
      pumpImageLoadQueue()
    }
    task.start(task.release)
  }
}

function scheduleImageLoad(priority, start) {
  const task = {
    cancelled: false,
    priority: priorityValue[priority] ?? priorityValue.auto,
    sequence: imageLoadSequence += 1,
    start,
    started: false,
    release: null,
  }
  imageLoadQueue.push(task)
  pumpImageLoadQueue()

  return () => {
    task.cancelled = true
    if (task.started) task.release?.()
  }
}

function getLocalUploadFilename(src) {
  if (typeof src !== "string" || !src.startsWith("/uploads/") || src.startsWith("/uploads/originals/") || src.startsWith("/uploads/variants/")) return null
  const pathname = src.split(/[?#]/, 1)[0]
  const filename = pathname.slice("/uploads/".length)
  if (!filename || filename.includes("/") || !/\.(?:png|jpe?g|webp|avif)$/i.test(filename)) return null
  try {
    return decodeURIComponent(filename)
  } catch {
    return null
  }
}

function buildLocalVariantUrl(filename, width) {
  return `/media/image/${encodeURIComponent(filename)}?w=${width}`
}

function getPlainImageSources(src, preferredWidth, responsive) {
  const filename = getLocalUploadFilename(src)
  if (!filename) return { src, srcSet: undefined }
  const width = LOCAL_IMAGE_WIDTHS.find((candidate) => preferredWidth <= candidate) || LOCAL_IMAGE_WIDTHS.at(-1)
  return {
    src: buildLocalVariantUrl(filename, width),
    srcSet: responsive
      ? LOCAL_IMAGE_WIDTHS.map((candidate) => `${buildLocalVariantUrl(filename, candidate)} ${candidate}w`).join(", ")
      : undefined,
  }
}

const QueuedPlainImage = React.forwardRef(({
  src,
  srcSet,
  sizes,
  loading = "lazy",
  loadPriority = "auto",
  alt = "",
  onLoad,
  onError,
  ...props
}, ref) => {
  const imgRef = React.useRef(null)
  const releaseRef = React.useRef(null)
  const retryTimerRef = React.useRef(null)
  const retryAttemptRef = React.useRef(0)
  const [nearViewport, setNearViewport] = React.useState(loading === "eager" || loadPriority === "high")
  const [requestVersion, setRequestVersion] = React.useState(0)
  const [started, setStarted] = React.useState(false)

  React.useImperativeHandle(ref, () => imgRef.current)

  React.useEffect(() => {
    retryAttemptRef.current = 0
    setStarted(false)
    setRequestVersion((current) => current + 1)
  }, [src, srcSet])

  React.useEffect(() => {
    if (nearViewport) return undefined
    const element = imgRef.current
    if (!element || typeof IntersectionObserver === "undefined") {
      setNearViewport(true)
      return undefined
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      setNearViewport(true)
      observer.disconnect()
    }, { rootMargin: "300px 0px", threshold: 0.01 })
    observer.observe(element)
    return () => observer.disconnect()
  }, [nearViewport])

  React.useEffect(() => {
    if (!nearViewport || !src) return undefined
    setStarted(false)
    const cancel = scheduleImageLoad(loadPriority, (release) => {
      releaseRef.current = release
      setStarted(true)
    })
    return () => {
      cancel()
      releaseRef.current = null
    }
  }, [loadPriority, nearViewport, requestVersion, src])

  React.useEffect(() => () => {
    if (retryTimerRef.current) window.clearTimeout(retryTimerRef.current)
    releaseRef.current?.()
  }, [])

  const releaseSlot = () => {
    releaseRef.current?.()
    releaseRef.current = null
  }

  const handleLoad = (event) => {
    retryAttemptRef.current = 0
    releaseSlot()
    onLoad?.(event)
  }

  const handleError = (event) => {
    releaseSlot()
    if (retryAttemptRef.current < 3) {
      const delay = 700 * (2 ** retryAttemptRef.current)
      retryAttemptRef.current += 1
      setStarted(false)
      retryTimerRef.current = window.setTimeout(() => {
        setRequestVersion((current) => current + 1)
      }, delay)
      return
    }
    onError?.(event)
  }

  return (
    <img
      ref={imgRef}
      src={started ? src : undefined}
      srcSet={started ? srcSet : undefined}
      sizes={started ? sizes : undefined}
      loading={started ? "eager" : undefined}
      decoding="async"
      alt={started ? alt : ""}
      onLoad={handleLoad}
      onError={handleError}
      {...props}
    />
  )
})
QueuedPlainImage.displayName = "QueuedPlainImage"

const ImageWrapper = React.forwardRef(({ aspectRatio, className, style, children }, ref) => (
  <span
    ref={ref}
    className={cn("inline-block relative", className)}
    style={{ aspectRatio, ...style }}
  >
    {children}
  </span>
))
ImageWrapper.displayName = "ImageWrapper"

const ResponsiveImage = React.forwardRef(
  ({ parsed, fittingType, focalPoint, quality, className, style, aspectRatio, onLoad, ...props }, parentRef) => {
    const wrapperRef = React.useRef(null)
    const imgRef = React.useRef(null)
    const size = useSize(wrapperRef)
    const [loaded, setLoaded] = React.useState(false)

    React.useImperativeHandle(parentRef, () => imgRef.current)

    // Reset the blur-up when the underlying image changes.
    React.useEffect(() => {
      setLoaded(false)
    }, [parsed.baseUrl])

    const crop = fittingType !== "fit"
    // `size` is null exactly once: the pre-measurement first render, which we
    // never let reach the network (see below — useSize measures before paint).
    // A *measured* zero (content-sized wrapper with no CSS dimensions) falls
    // back to a fixed transform width so the image itself can size the box.
    const options = size && {
      width: size.width || DEFAULT_TRANSFORM_WIDTH,
      height: size.height ? size.height : undefined,
      crop,
      focalPoint: crop ? focalPoint : undefined,
      quality,
    }

    // Both layers render only once the container is measured, so the first
    // URL the browser ever fetches is already the right size — never a
    // DEFAULT_TRANSFORM_WIDTH guess that gets replaced a frame later (a
    // wasted full-size download per image). useSize measures in
    // useLayoutEffect, so nothing is lost: measurement lands before the
    // first paint.
    return (
      <ImageWrapper ref={wrapperRef} aspectRatio={aspectRatio} className={className} style={style}>
        {/* Tiny blurred placeholder (a few hundred bytes) covering the main
            image's load time. Same crop shape and focal anchor as the main
            image — fp_ is relative to the crop box, so a square or centered
            placeholder would blur-preview a different region. */}
        {options && !loaded && (
          <img
            src={buildTransformUrl(parsed, {
              ...options,
              width: 20,
              height: options.height
                ? Math.max(1, Math.round((20 * options.height) / options.width))
                : undefined,
              quality: 20,
            })}
            alt=""
            aria-hidden="true"
            className="w-full h-full inset-0 absolute"
            style={{
              objectFit: fittingType === "fit" ? "contain" : "cover",
              filter: "blur(10px)",
              transform: "scale(1.1)",
            }}
          />
        )}
        {options && (
          <img
            ref={imgRef}
            src={buildTransformUrl(parsed, options)}
            srcSet={buildSrcSet(parsed, options)}
            loading="lazy"
            decoding="async"
            className={cn(
              "w-full h-full inset-0 absolute",
              fittingType === "fit" ? "object-contain" : "object-cover"
            )}
            onLoad={(e) => {
              setLoaded(true)
              onLoad?.(e)
            }}
            {...props}
          />
        )}
      </ImageWrapper>
    )
  }
)
ResponsiveImage.displayName = "ResponsiveImage"

/**
 * Image with built-in Wix Media Platform support: canonical public images on
 * static.wixstatic.com/media are resized to the rendered
 * container per device pixel ratio and re-encoded to WebP; `fittingType="fill"`
 * crops server-side, optionally anchored at a focal point. Other URLs render
 * as a plain <img>. Failed transforms retry the original URL; only a broken
 * original swaps to the generic fallback image.
 */
const Image = React.forwardRef(
  (
    {
      src,
      fittingType = "fill",
      originWidth,
      originHeight,
      focalPointX,
      focalPointY,
      quality = 90,
      imageWidth = 960,
      imageSizes,
      responsive = true,
      loadPriority = "auto",
      onError,
      ...props
    },
    ref
  ) => {
    const parsedSource = src ? parseWixMediaUrl(src) : null
    const initialMode = parsedSource ? IMAGE_LOAD_MODE.OPTIMIZED : IMAGE_LOAD_MODE.ORIGINAL
    const [loadState, setLoadState] = React.useState({ src, mode: initialMode })
    const mode = loadState.src === src ? loadState.mode : initialMode

    React.useEffect(() => {
      setLoadState({ src, mode: initialMode })
    }, [src, initialMode])

    const handleError = (event) => {
      if (mode === IMAGE_LOAD_MODE.FALLBACK) return
      const nextMode = nextImageLoadMode(mode)
      setLoadState({ src, mode: nextMode })
      if (nextMode === IMAGE_LOAD_MODE.FALLBACK) onError?.(event)
    }

    const imageProps = {
      ...props,
      onError: handleError,
    }

    if (!src || mode === IMAGE_LOAD_MODE.FALLBACK) return null

    // A failed transform retries the underlying original as a plain image.
    // Only a failure of that original advances to the generic fallback.
    const parsed = mode === IMAGE_LOAD_MODE.OPTIMIZED ? parsedSource : null

    if (!parsed) {
      const imageSrc = getOriginalImageUrl(src, parsedSource)
      const sources = getPlainImageSources(imageSrc, imageWidth, responsive)
      return (
        <QueuedPlainImage
          ref={ref}
          src={sources.src}
          srcSet={sources.srcSet}
          sizes={imageSizes || `${imageWidth}px`}
          loadPriority={loadPriority}
          {...imageProps}
        />
      )
    }

    const focalPoint =
      typeof focalPointX === "number" && typeof focalPointY === "number"
        ? { x: focalPointX, y: focalPointY }
        : undefined
    // Origin dimensions are optional — when known they stabilize layout via
    // the wrapper's aspect-ratio before the image loads.
    const aspectRatio =
      originWidth && originHeight ? `${originWidth} / ${originHeight}` : undefined

    return (
      <ResponsiveImage
        ref={ref}
        parsed={parsed}
        fittingType={fittingType}
        focalPoint={focalPoint}
        quality={quality}
        aspectRatio={aspectRatio}
        {...imageProps}
      />
    )
  }
)
Image.displayName = "Image"

export { Image }
