'use client'

import * as React from 'react'

interface HudBackgroundProps {
  className?: string
  particleCount?: number
  showGrid?: boolean
  zIndex?: number
}

export function HudBackground({
  className = '',
  particleCount = 40,
  showGrid = true,
  zIndex = 1,
}: HudBackgroundProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const animationRef = React.useRef<number>(0)
  const mouseRef = React.useRef({ x: 0, y: 0 })

  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let width = 0
    let height = 0

    const resize = () => {
      width = canvas.width = window.innerWidth
      height = canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY }
    }
    window.addEventListener('mousemove', onMouseMove)

    // Particles
    interface Particle {
      x: number; y: number; vx: number; vy: number
      size: number; opacity: number; pulse: number; speed: number
    }

    const particles: Particle[] = Array.from({ length: particleCount }, () => ({
      x:       Math.random() * window.innerWidth,
      y:       Math.random() * window.innerHeight,
      vx:      (Math.random() - 0.5) * 0.3,
      vy:      (Math.random() - 0.5) * 0.3,
      size:    Math.random() * 1.5 + 0.5,
      opacity: Math.random() * 0.4 + 0.1,
      pulse:   Math.random() * Math.PI * 2,
      speed:   Math.random() * 0.02 + 0.01,
    }))

    let frame = 0

    const draw = () => {
      ctx.clearRect(0, 0, width, height)
      frame++

      const { x: mx, y: my } = mouseRef.current

      if (showGrid) {
        // Dot grid
        const spacing = 60
        const cols = Math.ceil(width / spacing) + 1
        const rows = Math.ceil(height / spacing) + 1

        for (let i = 0; i < cols; i++) {
          for (let j = 0; j < rows; j++) {
            const gx = i * spacing
            const gy = j * spacing
            const dist = Math.sqrt((gx - mx) ** 2 + (gy - my) ** 2)
            const maxDist = 250
            const proximity = Math.max(0, 1 - dist / maxDist)
            const baseOpacity = 0.06
            const opacity = baseOpacity + proximity * 0.18

            ctx.beginPath()
            ctx.arc(gx, gy, 0.8 + proximity * 1.2, 0, Math.PI * 2)
            ctx.fillStyle = `oklch(0.82 0.17 200 / ${opacity})`
            ctx.fill()
          }
        }

        // Horizontal scan lines (very subtle)
        const scanY = ((frame * 0.3) % height)
        const grad = ctx.createLinearGradient(0, scanY - 60, 0, scanY + 60)
        grad.addColorStop(0, 'transparent')
        grad.addColorStop(0.5, `oklch(0.82 0.17 200 / 0.03)`)
        grad.addColorStop(1, 'transparent')
        ctx.fillStyle = grad
        ctx.fillRect(0, scanY - 60, width, 120)
      }

      // Particles
      particles.forEach((p) => {
        p.pulse += p.speed
        const pOpacity = p.opacity * (0.6 + 0.4 * Math.sin(p.pulse))

        // Mouse attraction (subtle)
        const dx = mx - p.x
        const dy = my - p.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < 180) {
          p.vx += dx * 0.0001
          p.vy += dy * 0.0001
        }

        p.x += p.vx
        p.y += p.vy

        // Damping
        p.vx *= 0.99
        p.vy *= 0.99

        // Wrap
        if (p.x < 0) p.x = width
        if (p.x > width) p.x = 0
        if (p.y < 0) p.y = height
        if (p.y > height) p.y = 0

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = `oklch(0.82 0.17 200 / ${pOpacity})`
        ctx.fill()
      })

      // Connect nearby particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 120) {
            const opacity = (1 - dist / 120) * 0.08
            ctx.beginPath()
            ctx.moveTo(particles[i].x, particles[i].y)
            ctx.lineTo(particles[j].x, particles[j].y)
            ctx.strokeStyle = `oklch(0.82 0.17 200 / ${opacity})`
            ctx.lineWidth = 0.5
            ctx.stroke()
          }
        }
      }

      animationRef.current = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      cancelAnimationFrame(animationRef.current)
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', onMouseMove)
    }
  }, [particleCount, showGrid])

  return (
    <canvas
      ref={canvasRef}
      className={`fixed inset-0 pointer-events-none ${className}`}
      style={{ zIndex }}
      aria-hidden="true"
    />
  )
}
