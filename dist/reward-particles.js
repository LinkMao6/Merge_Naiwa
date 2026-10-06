// Explosion 3 / Explosion Ring behavior adapted for our Canvas 2D renderer.
// PixiJS Particle Emitter, MIT (c) 2015 CloudKid.
// Upstream 0fffdd9d18cabd99e5ee1d5dc94136613d5fcb04; license in vendor/.
// This module owns visual particles only, never actors, targets or score.
export function createRewardParticles({reduced=false,lowEffects=()=>false}={}) {
  let particles=[];
  function emit(x,y,size=60) {
    if(reduced)return;
    const scale=Math.max(.6,Math.min(1.4,size/80));
    const count=lowEffects()?8:16;
    for(let i=0;i<count;i++) {
      const angle=(i+Math.random()*.65)*Math.PI*2/count;
      particles.push({x,y,angle,age:-Math.random()*40,life:310+Math.random()*300,
        speed:(300+Math.random()*400)*scale*.45,size:(1.8+Math.random()*2.8)*scale,
        ring:i%3===0,rotation:Math.random()*Math.PI,spin:(Math.random()-.5)*8});
    }
    particles=particles.slice(-60);
  }
  function update(dt) {for(const p of particles)p.age+=dt;particles=particles.filter(p=>p.age<p.life);}
  function draw(ctx) {
    ctx.save();
    for(const p of particles){
      if(p.age<0)continue;
      const t=Math.min(1,p.age/p.life),distance=p.speed*p.life/1000*(t-t*t/2),c=Math.cos(p.angle),s=Math.sin(p.angle);
      const x=p.x+c*distance,y=p.y+s*distance+22*t*t;
      const alpha=.9*(1-t)**1.4,r=p.size*(1-t*.76);
      ctx.globalAlpha=alpha;ctx.strokeStyle=t<.18?'#f6c750':'#b68120';ctx.fillStyle=t<.25?'#edbd49':'#a87822';
      if(p.ring){ctx.save();ctx.translate(x,y);ctx.rotate(p.rotation+p.spin*t);ctx.fillRect(-r,-r*.55,r*2,r*1.1);ctx.restore();}
      else{const tail=(5+14*(1-t))*(1-t);ctx.lineWidth=Math.max(.65,r*.7);ctx.lineCap='round';ctx.beginPath();ctx.moveTo(x-c*tail,y-s*tail);ctx.lineTo(x,y);ctx.stroke();ctx.beginPath();ctx.arc(x,y,r*.65,0,Math.PI*2);ctx.fill();}
    }
    ctx.restore();
  }
  return {emit,update,draw,reset(){particles=[];},get count(){return particles.length;}};
}
