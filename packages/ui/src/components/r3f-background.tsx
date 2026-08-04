'use client'

import * as React from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

/* ----------------------------------------------------------------
   ParticleField — 浮遊するゴールド+シアン粒子
   ---------------------------------------------------------------- */
function ParticleField() {
  const meshRef = React.useRef<THREE.Points>(null)
  const count = 800

  const { positions, colors } = React.useMemo(() => {
    const positions = new Float32Array(count * 3)
    const colors    = new Float32Array(count * 3)
    const goldColor  = new THREE.Color('#C9A84C')
    const cyanColor  = new THREE.Color('#00D4FF')
    const blueColor  = new THREE.Color('#3B7BFF')

    for (let i = 0; i < count; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * 30
      positions[i * 3 + 1] = (Math.random() - 0.5) * 20
      positions[i * 3 + 2] = (Math.random() - 0.5) * 20

      const r = Math.random()
      const c = r < 0.4 ? goldColor : r < 0.7 ? cyanColor : blueColor
      colors[i * 3]     = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b
    }
    return { positions, colors }
  }, [])

  useFrame((state) => {
    if (!meshRef.current) return
    const t = state.clock.elapsedTime * 0.04
    meshRef.current.rotation.y = t
    meshRef.current.rotation.x = t * 0.3
  })

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color"    args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.055}
        vertexColors
        transparent
        opacity={0.55}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  )
}

/* ----------------------------------------------------------------
   GridLines — 3D ワイヤーグリッド
   ---------------------------------------------------------------- */
function GridLines() {
  const groupRef = React.useRef<THREE.Group>(null)

  const geometry = React.useMemo(() => {
    const geo  = new THREE.BufferGeometry()
    const verts: number[] = []
    const size = 15
    const step = 2.5

    for (let i = -size; i <= size; i += step) {
      // Horizontal lines
      verts.push(-size, i, 0,  size, i, 0)
      // Vertical lines
      verts.push(i, -size, 0,  i, size, 0)
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3))
    return geo
  }, [])

  useFrame((state) => {
    if (!groupRef.current) return
    const t = state.clock.elapsedTime
    groupRef.current.rotation.x = 0.55 + Math.sin(t * 0.05) * 0.05
    groupRef.current.rotation.y = t * 0.015
    groupRef.current.position.z = -8
  })

  return (
    <group ref={groupRef}>
      <lineSegments geometry={geometry}>
        <lineBasicMaterial color="#C9A84C" transparent opacity={0.07} />
      </lineSegments>
    </group>
  )
}

/* ----------------------------------------------------------------
   EnergyRings — ゆっくり回転するホログラムリング
   ---------------------------------------------------------------- */
function EnergyRings() {
  const ref1 = React.useRef<THREE.Mesh>(null)
  const ref2 = React.useRef<THREE.Mesh>(null)
  const ref3 = React.useRef<THREE.Mesh>(null)

  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (ref1.current) { ref1.current.rotation.z = t * 0.12; ref1.current.rotation.x = t * 0.05 }
    if (ref2.current) { ref2.current.rotation.z = -t * 0.08; ref2.current.rotation.y = t * 0.04 }
    if (ref3.current) { ref3.current.rotation.y = t * 0.06; ref3.current.rotation.x = -t * 0.03 }
  })

  const ringGeo = (inner: number, outer: number) =>
    new THREE.RingGeometry(inner, outer, 80)

  return (
    <group position={[0, 0, -4]}>
      <mesh ref={ref1} geometry={ringGeo(3.8, 4)}>
        <meshBasicMaterial color="#C9A84C" transparent opacity={0.12} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={ref2} geometry={ringGeo(5.5, 5.65)}>
        <meshBasicMaterial color="#00D4FF" transparent opacity={0.08} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={ref3} geometry={ringGeo(7.2, 7.32)}>
        <meshBasicMaterial color="#3B7BFF" transparent opacity={0.06} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

/* ----------------------------------------------------------------
   FloatingLines — エネルギーライン
   ---------------------------------------------------------------- */
function FloatingLines() {
  const groupRef = React.useRef<THREE.Group>(null)

  const lines = React.useMemo(() => {
    return Array.from({ length: 8 }, (_, i) => {
      const angle  = (i / 8) * Math.PI * 2
      const radius = 5 + Math.random() * 3
      const points = [
        new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, -5),
        new THREE.Vector3(Math.cos(angle) * (radius - 2), Math.sin(angle) * (radius - 2), -2),
      ]
      const geo = new THREE.BufferGeometry().setFromPoints(points)
      const isGold = i % 3 === 0
      return { geo, isGold }
    })
  }, [])

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.z = state.clock.elapsedTime * 0.03
    }
  })

  return (
    <group ref={groupRef}>
      {lines.map((line, i) => (
        <lineSegments key={i} geometry={line.geo}>
          <lineBasicMaterial
            color={line.isGold ? '#C9A84C' : '#00D4FF'}
            transparent
            opacity={0.15}
          />
        </lineSegments>
      ))}
    </group>
  )
}

/* ----------------------------------------------------------------
   CameraRig — マウスでカメラが緩やかに動く
   ---------------------------------------------------------------- */
function CameraRig() {
  const { camera } = useThree()
  const mouseRef   = React.useRef({ x: 0, y: 0 })

  React.useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouseRef.current.x = (e.clientX / window.innerWidth  - 0.5) * 2
      mouseRef.current.y = (e.clientY / window.innerHeight - 0.5) * 2
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  useFrame(() => {
    camera.position.x += (mouseRef.current.x * 1.2 - camera.position.x) * 0.025
    camera.position.y += (-mouseRef.current.y * 0.8 - camera.position.y) * 0.025
    camera.lookAt(0, 0, 0)
  })

  return null
}

/* ----------------------------------------------------------------
   Main Export
   ---------------------------------------------------------------- */
interface R3FBackgroundProps {
  className?: string
}

export function R3FBackground({ className = '' }: R3FBackgroundProps) {
  return (
    <div
      className={`fixed inset-0 pointer-events-none ${className}`}
      style={{ zIndex: -1 }}
      aria-hidden="true"
    >
      <Canvas
        camera={{ position: [0, 0, 10], fov: 60 }}
        gl={{
          antialias: false,
          alpha:     true,
          powerPreference: 'low-power',
        }}
        dpr={[1, 1.5]}
      >
        <CameraRig />
        <GridLines />
        <EnergyRings />
        <ParticleField />
        <FloatingLines />
      </Canvas>
    </div>
  )
}
