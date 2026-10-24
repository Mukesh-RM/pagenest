import { CollectionsScreen } from '@/features/library';
import { Screen } from '../components/PageHeader';
import '../screen-styles';

/**
 * Collections (route `/collections`): the Library's `CollectionsScreen` (shelves, smart shelves, new
 * shelf, rename, delete, a shelf's books) in the design system's page frame.
 */
export function CollectionsPage() {
  return (
    <Screen>
      <CollectionsScreen />
    </Screen>
  );
}
