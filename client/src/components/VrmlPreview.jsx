import React, { useEffect, useRef, useState } from "react";

const VrmlPreview = ({ storageKey, authToken }) => {
  const containerRef = useRef(null);
  const rendererRef = useRef(null);
  const animationRef = useRef(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let scene, camera, controls, object3D;
    let disposed = false;

    const init = async () => {
      setLoading(true);
      setError(null);
      try {
        const THREE = await import('three');
        const { VRMLLoader } = await import('three/examples/jsm/loaders/VRMLLoader.js');
        const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');

        if (disposed) return;

        const container = containerRef.current;
        const width = container.clientWidth;
        const height = container.clientHeight;

        // Scene
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0xf7fafc); // gray-50 like

        // Camera
        camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 10000);
        camera.position.set(3, 3, 6);

        // Lights
        const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
        hemi.position.set(0, 20, 0);
        scene.add(hemi);
        const dir = new THREE.DirectionalLight(0xffffff, 0.8);
        dir.position.set(5, 10, 7.5);
        scene.add(dir);

        // Renderer
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(width, height);
        container.innerHTML = "";
        container.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        // Controls
        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;

        // Load VRML
        const resp = await fetch(`/api/files/${storageKey}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}`);
        }
        const text = await resp.text();

        const loader = new VRMLLoader();
        object3D = loader.parse(text);
        if (!object3D) throw new Error("Failed to parse VRML");

        // Center and scale to fit view
        object3D.traverse((child) => {
          if (child.isMesh) {
            child.geometry.computeBoundingSphere?.();
            child.geometry.computeBoundingBox?.();
          }
        });
        const bbox = new THREE.Box3().setFromObject(object3D);
        const center = bbox.getCenter(new THREE.Vector3());
        const size = bbox.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        const scale = 2 / maxDim; // fit roughly into view
        object3D.scale.setScalar(scale);
        object3D.position.sub(center.multiplyScalar(scale));
        scene.add(object3D);

        // Animate
        const animate = () => {
          if (disposed) return;
          controls.update();
          renderer.render(scene, camera);
          animationRef.current = requestAnimationFrame(animate);
        };
        animate();

        // Resize handler
        const handleResize = () => {
          if (!container || !renderer) return;
          const w = container.clientWidth;
          const h = container.clientHeight;
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        };
        window.addEventListener("resize", handleResize);

        // Cleanup
        return () => {
          window.removeEventListener("resize", handleResize);
        };
      } catch (e) {
        console.error("VRML preview error:", e);
        setError(e.message || "Failed to load VRML");
      } finally {
        if (!disposed) setLoading(false);
      }
    };

    const cleanup = () => {
      disposed = true;
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (rendererRef.current) {
        try {
          rendererRef.current.dispose?.();
        } catch {}
        rendererRef.current = null;
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };

    init();

    return cleanup;
  }, [storageKey, authToken]);

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <div
        ref={containerRef}
        className="bg-white dark:bg-gray-800"
        style={{ width: "100%", height: 320 }}
      />
      {loading && (
        <div className="p-2 text-center text-xs text-gray-500">Loading 3D preview…</div>
      )}
      {error && (
        <div className="p-2 text-center text-xs text-red-600">{error}</div>
      )}
    </div>
  );
};

export default VrmlPreview;
