/**
 * The dashboard can run on localhost while customer links must use a public
 * tenant hostname. Keep this setting separate from the local frontend origin.
 */
export function studioPublicRootDomain():string {
  const configured=process.env.STUDIO_PUBLIC_ROOT_DOMAIN||
    process.env.ROOT_DOMAIN||process.env.NEXT_PUBLIC_ROOT_DOMAIN||'localhost';
  const root=configured.trim().toLowerCase()
    .replace(/^https?:\/\//,'').split('/')[0].replace(/:\d+$/,'');
  return /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(root)?root:'localhost';
}
