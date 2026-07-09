"use client";
import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import styles from './HomeCarousel.module.css';

interface Slide {
  id: string;
  title: string;
  subtitle: string;
  image_url: string;
  link_url: string;
  display_order: number;
  is_active: number;
}

interface HomeCarouselProps {
  slides: Slide[];
}

export default function HomeCarousel({ slides }: HomeCarouselProps) {
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // If there are no slides, render nothing
  if (!slides || slides.length === 0) return null;

  // Carousel advances via autoplay and dot indicators only — no arrow controls.
  const nextSlide = () => {
    setCurrent((prev) => (prev === slides.length - 1 ? 0 : prev + 1));
  };

  const setSlide = (index: number) => {
    setCurrent(index);
  };

  // Setup autoplay timer (rotation every 5 seconds)
  useEffect(() => {
    if (isPaused) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      return;
    }

    timeoutRef.current = setTimeout(() => {
      nextSlide();
    }, 5000);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [current, isPaused, slides.length]);

  return (
    <div 
      className={styles.carouselContainer}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      aria-label="Promotions and Highlights"
    >
      {/* Slides Wrapper */}
      <div className={styles.slidesWrapper}>
        {slides.map((slide, index) => {
          const isActive = index === current;
          return (
            <div 
              key={slide.id} 
              className={`${styles.slide} ${isActive ? styles.slideActive : ''}`}
              aria-hidden={!isActive}
            >
              {/* Slide Background Image */}
              <div className={styles.imageOverlay} />
              <Image
                src={slide.image_url}
                alt=""
                fill
                priority={index === 0}
                sizes="100vw"
                className={styles.slideImage}
                style={{ objectFit: 'cover' }}
              />

              {/* Slide Content Overlay */}
              <div className={styles.contentContainer}>
                <div className={`${styles.content} ${isActive ? styles.animateContent : ''}`}>
                  <span className={styles.badgeLabel}>Featured Promotion</span>
                  <h2 className={styles.title}>{slide.title}</h2>
                  <p className={styles.subtitle}>{slide.subtitle}</p>
                  <Link href={slide.link_url} className="btn btn-primary" style={{ padding: '0.8rem 2rem', display: 'inline-block' }}>
                    Shop Now
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>



      {/* Dot Indicators */}
      {slides.length > 1 && (
        <div className={styles.dotsList}>
          {slides.map((_, index) => (
            <button 
              key={index} 
              onClick={() => setSlide(index)} 
              className={`${styles.dot} ${index === current ? styles.dotActive : ''}`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
