export function assertSpriteImage(stage,image){
  const [width,height]=stage.imageSize||[];
  const [x,y,w,h]=stage.sourceRect;
  if(!width||!height||image.naturalWidth!==width||image.naturalHeight!==height||x<0||y<0||w<=0||h<=0||x+w>width||y+h>height){
    throw Error(stage.name+'图片版本不匹配，请重新加载');
  }
}
