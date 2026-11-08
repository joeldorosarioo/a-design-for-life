import type { ResolvedNavigationDTO } from './resolved-navigation-dto.schema';
import type { PreviewNavigationPresentationDTO } from './preview-navigation-presentation-dto.schema';

/** Both forms contain resolved presentation destinations, never Native documents or grants. */
export type NavigationPresentation = ResolvedNavigationDTO | PreviewNavigationPresentationDTO;
