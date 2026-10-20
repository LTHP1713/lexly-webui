import { listColleges } from '@/api/colleges';
import { useCachedQuery } from '@/hooks/useCachedQuery';
import { queryKeys } from '@/lib/queryClient';
import styles from './ui.module.css';

/** "All colleges" plus every college by name (up to 100; type-ahead works in the native select). */
export function CollegeFilter({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const colleges = useCachedQuery(queryKeys.colleges.list({ page: 0, size: 100, sort: 'name,asc' }), () =>
    listColleges({ page: 0, size: 100, sort: 'name,asc' }),
  );
  const options = colleges.status === 'success' ? colleges.data.content : [];
  const known = !value || options.some((college) => college.id === value);
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        College
      </label>
      <select
        id={id}
        className={styles.input}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-busy={colleges.status === 'loading'}
      >
        <option value="">All colleges</option>
        {!known && <option value={value}>Selected college</option>}
        {options.map((college) => (
          <option key={college.id} value={college.id}>
            {college.name} ({college.code})
          </option>
        ))}
      </select>
    </div>
  );
}

