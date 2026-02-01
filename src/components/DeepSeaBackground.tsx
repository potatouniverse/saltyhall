"use client";

import { useRef, useMemo, useEffect, useState, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

const COLORS = {
  cyan: new THREE.Color("#00d4ff"),
  purple: new THREE.Color("#8b5cf6"),
  green: new THREE.Color("#00ffc8"),
  bg: new THREE.Color("#0a0e1a"),
};

function Particles({ count }: { count: number }) {
  const mesh = useRef<THREE.Points>(null);
  const mouse = useRef({ x: 0, y: 0 });

  const { positions, colors, sizes, speeds, phases } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const speeds = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    const palette = [COLORS.cyan, COLORS.purple, COLORS.green];

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 40;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 30;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 30 - 5;

      const c = palette[Math.floor(Math.random() * 3)];
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;

      sizes[i] = Math.random() * 3 + 1;
      speeds[i * 3] = (Math.random() - 0.5) * 0.3;
      speeds[i * 3 + 1] = (Math.random() - 0.5) * 0.2;
      speeds[i * 3 + 2] = (Math.random() - 0.5) * 0.15;
      phases[i] = Math.random() * Math.PI * 2;
    }
    return { positions, colors, sizes, speeds, phases };
  }, [count]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener("mousemove", handler);
    return () => window.removeEventListener("mousemove", handler);
  }, []);

  const shaderMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uMouse: { value: new THREE.Vector2(0, 0) },
        },
        vertexShader: `
          attribute float size;
          attribute float phase;
          uniform float uTime;
          uniform vec2 uMouse;
          varying vec3 vColor;
          varying float vAlpha;
          void main() {
            vColor = color;
            float pulse = sin(uTime * 0.8 + phase) * 0.5 + 0.5;
            vAlpha = 0.4 + pulse * 0.6;
            vec3 pos = position;
            pos.x += uMouse.x * 0.5 * (1.0 - abs(position.z) / 20.0);
            pos.y += uMouse.y * 0.3 * (1.0 - abs(position.z) / 20.0);
            vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
            gl_PointSize = size * (200.0 / -mvPosition.z) * (0.7 + pulse * 0.3);
            gl_Position = projectionMatrix * mvPosition;
          }
        `,
        fragmentShader: `
          varying vec3 vColor;
          varying float vAlpha;
          void main() {
            float d = length(gl_PointCoord - vec2(0.5));
            if (d > 0.5) discard;
            float glow = 1.0 - smoothstep(0.0, 0.5, d);
            glow = pow(glow, 1.5);
            gl_FragColor = vec4(vColor, glow * vAlpha * 0.8);
          }
        `,
        transparent: true,
        depthWrite: false,
        vertexColors: true,
        blending: THREE.AdditiveBlending,
      }),
    []
  );

  useFrame((_, delta) => {
    if (!mesh.current) return;
    const geo = mesh.current.geometry;
    const posAttr = geo.getAttribute("position") as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;
    const t = performance.now() * 0.001;

    for (let i = 0; i < count; i++) {
      arr[i * 3] += speeds[i * 3] * delta;
      arr[i * 3 + 1] += speeds[i * 3 + 1] * delta;
      arr[i * 3 + 2] += speeds[i * 3 + 2] * delta;

      // Wrap around
      if (arr[i * 3] > 20) arr[i * 3] = -20;
      if (arr[i * 3] < -20) arr[i * 3] = 20;
      if (arr[i * 3 + 1] > 15) arr[i * 3 + 1] = -15;
      if (arr[i * 3 + 1] < -15) arr[i * 3 + 1] = 15;
    }
    posAttr.needsUpdate = true;

    shaderMaterial.uniforms.uTime.value = t;
    shaderMaterial.uniforms.uMouse.value.set(mouse.current.x, mouse.current.y);
  });

  return (
    <points ref={mesh} material={shaderMaterial}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        <bufferAttribute attach="attributes-size" args={[sizes, 1]} />
        <bufferAttribute attach="attributes-phase" args={[phases, 1]} />
      </bufferGeometry>
    </points>
  );
}

function NeuralLines({ count }: { count: number }) {
  const ref = useRef<THREE.LineSegments>(null);
  const posArray = useMemo(() => new Float32Array(count * 6), [count]);
  const colArray = useMemo(() => new Float32Array(count * 6), [count]);
  const alphas = useRef(new Float32Array(count).fill(0));
  const targets = useRef(new Float32Array(count * 6));
  const lastRegen = useRef(0);

  const regenerate = useCallback(() => {
    for (let i = 0; i < count; i++) {
      const x1 = (Math.random() - 0.5) * 30;
      const y1 = (Math.random() - 0.5) * 20;
      const z1 = (Math.random() - 0.5) * 20 - 5;
      const x2 = x1 + (Math.random() - 0.5) * 6;
      const y2 = y1 + (Math.random() - 0.5) * 4;
      const z2 = z1 + (Math.random() - 0.5) * 4;
      targets.current[i * 6] = x1;
      targets.current[i * 6 + 1] = y1;
      targets.current[i * 6 + 2] = z1;
      targets.current[i * 6 + 3] = x2;
      targets.current[i * 6 + 4] = y2;
      targets.current[i * 6 + 5] = z2;
      alphas.current[i] = 0;
    }
  }, [count]);

  useEffect(() => { regenerate(); }, [regenerate]);

  useFrame((_, delta) => {
    if (!ref.current) return;
    const t = performance.now() * 0.001;
    if (t - lastRegen.current > 4) {
      regenerate();
      lastRegen.current = t;
    }

    const geo = ref.current.geometry;
    const posAttr = geo.getAttribute("position") as THREE.BufferAttribute;
    const colAttr = geo.getAttribute("color") as THREE.BufferAttribute;
    const pos = posAttr.array as Float32Array;
    const col = colAttr.array as Float32Array;

    for (let i = 0; i < count; i++) {
      const phase = (t * 0.5 + i * 0.3) % 4;
      const a = phase < 1 ? phase : phase < 3 ? 1 : 4 - phase;
      alphas.current[i] = Math.max(0, Math.min(1, a)) * 0.15;

      for (let j = 0; j < 6; j++) {
        pos[i * 6 + j] = targets.current[i * 6 + j];
      }
      const al = alphas.current[i];
      col[i * 6] = 0; col[i * 6 + 1] = 0.83 * al; col[i * 6 + 2] = 1.0 * al;
      col[i * 6 + 3] = 0; col[i * 6 + 4] = 0.83 * al; col[i * 6 + 5] = 1.0 * al;
    }
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
  });

  return (
    <lineSegments ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[posArray, 3]} />
        <bufferAttribute attach="attributes-color" args={[colArray, 3]} />
      </bufferGeometry>
      <lineBasicMaterial vertexColors transparent opacity={1} blending={THREE.AdditiveBlending} depthWrite={false} />
    </lineSegments>
  );
}

function FloatingShapes() {
  const shapes = useMemo(() => {
    return Array.from({ length: 4 }, (_, i) => ({
      position: [
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 15,
        -8 - Math.random() * 10,
      ] as [number, number, number],
      rotation: Math.random() * Math.PI,
      speed: 0.1 + Math.random() * 0.15,
      scale: 1 + Math.random() * 1.5,
      type: i % 2 === 0 ? "icosahedron" : "octahedron",
      color: i % 3 === 0 ? "#00d4ff" : i % 3 === 1 ? "#8b5cf6" : "#00ffc8",
    }));
  }, []);

  return (
    <>
      {shapes.map((s, i) => (
        <RotatingShape key={i} {...s} />
      ))}
    </>
  );
}

function RotatingShape({
  position, speed, scale, type, color,
}: {
  position: [number, number, number];
  rotation: number;
  speed: number;
  scale: number;
  type: string;
  color: string;
}) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (!ref.current) return;
    ref.current.rotation.x += speed * delta * 0.5;
    ref.current.rotation.y += speed * delta * 0.3;
  });

  return (
    <mesh ref={ref} position={position} scale={scale}>
      {type === "icosahedron" ? (
        <icosahedronGeometry args={[1, 0]} />
      ) : (
        <octahedronGeometry args={[1, 0]} />
      )}
      <meshBasicMaterial color={color} wireframe transparent opacity={0.06} />
    </mesh>
  );
}

function GodRays() {
  const ref = useRef<THREE.Mesh>(null);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 } },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform float uTime;
          varying vec2 vUv;
          void main() {
            float ray1 = smoothstep(0.3, 0.0, abs(vUv.x - 0.3 + sin(uTime * 0.2) * 0.1));
            float ray2 = smoothstep(0.25, 0.0, abs(vUv.x - 0.6 + cos(uTime * 0.15) * 0.08));
            float ray3 = smoothstep(0.2, 0.0, abs(vUv.x - 0.8 + sin(uTime * 0.25 + 1.0) * 0.06));
            float fade = pow(1.0 - vUv.y, 2.0);
            float rays = (ray1 + ray2 * 0.7 + ray3 * 0.5) * fade * 0.04;
            gl_FragColor = vec4(0.3, 0.7, 1.0, rays);
          }
        `,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      }),
    []
  );

  useFrame(() => {
    material.uniforms.uTime.value = performance.now() * 0.001;
  });

  return (
    <mesh ref={ref} position={[0, 8, -10]} material={material}>
      <planeGeometry args={[40, 25]} />
    </mesh>
  );
}

function Scene({ isMobile }: { isMobile: boolean }) {
  const { gl } = useThree();
  
  useEffect(() => {
    gl.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  }, [gl]);

  const particleCount = isMobile ? 800 : 2000;
  const lineCount = isMobile ? 20 : 50;

  return (
    <>
      <fog attach="fog" args={["#0a0e1a", 8, 35]} />
      <Particles count={particleCount} />
      <NeuralLines count={lineCount} />
      <FloatingShapes />
      <GodRays />
    </>
  );
}

export default function DeepSeaBackground() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        zIndex: 0,
        pointerEvents: "none",
      }}
    >
      <Canvas
        gl={{ antialias: false, alpha: false, powerPreference: "low-power" }}
        camera={{ position: [0, 0, 10], fov: 60 }}
        dpr={[1, 1.5]}
        style={{ background: "#0a0e1a" }}
        frameloop="always"
      >
        <Scene isMobile={isMobile} />
      </Canvas>
    </div>
  );
}
