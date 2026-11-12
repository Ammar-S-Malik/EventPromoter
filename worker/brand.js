// The brand file as a module, so the Worker bundle and the tests read the same palette and limits.
import brand from '../brand/brand.json' with { type: 'json' };
export default brand;
