export function registerGardenShaders(B: any) {
  B.Effect.ShadersStore.gardenSkyVertexShader = `
    precision highp float;
    attribute vec3 position;
    uniform mat4 worldViewProjection;
    varying vec3 vPosition;
    void main(void){ vPosition = position; gl_Position = worldViewProjection * vec4(position, 1.0); }
  `;
  B.Effect.ShadersStore.gardenSkyFragmentShader = `
    precision highp float;
    varying vec3 vPosition;
    uniform float time;
    uniform float cloudiness;
    uniform vec3 topColor;
    uniform vec3 horizonColor;
    float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
    float noise(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y); }
    void main(void){
      vec3 d=normalize(vPosition); float h=clamp(d.y*.5+.5,0.,1.);
      vec3 base=mix(horizonColor,topColor,pow(h,.72));
      vec2 p=d.xz/(abs(d.y)+.35)*1.3+vec2(time*.003,0.);
      float c=noise(p)+.5*noise(p*2.1+5.); c=smoothstep(1.0-cloudiness*.35,1.42,c);
      gl_FragColor=vec4(mix(base,vec3(.93,.94,.91),c*.58),1.0);
    }
  `;
  B.Effect.ShadersStore.gardenWaterVertexShader = `
    precision highp float;
    attribute vec3 position; attribute vec2 uv;
    uniform mat4 worldViewProjection; uniform float time; uniform float rain;
    varying vec2 vUV; varying float wave;
    void main(void){ vec3 p=position; float w=sin((p.x+p.y)*5.+time*.0018)*.025+cos(p.x*9.-time*.002)*.012; p.z+=w*(1.+rain*.8); wave=w; vUV=uv; gl_Position=worldViewProjection*vec4(p,1.0); }
  `;
  B.Effect.ShadersStore.gardenWaterFragmentShader = `
    precision highp float;
    varying vec2 vUV; varying float wave; uniform float time; uniform float rain; uniform vec3 skyTint;
    float ring(vec2 p,vec2 c,float t){ float d=length(p-c); return smoothstep(.025,0.,abs(d-t)); }
    void main(void){
      float rip=ring(vUV,vec2(.23,.64),mod(time*.00022,.48))+ring(vUV,vec2(.72,.31),mod(time*.00018+.2,.55));
      float glint=pow(max(0.,sin((vUV.x+vUV.y)*24.+time*.0015)),12.)*.16;
      vec3 col=mix(vec3(.08,.22,.22),skyTint,.56)+vec3(glint+rip*(.12+rain*.18));
      gl_FragColor=vec4(col,.91);
    }
  `;
}
