import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import PropTypes from 'prop-types';

export function AssignedUserDisplay({ userId }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId) return;

    async function loadProfile() {
      try {
        const { data, error } = await supabase
          .rpc('get_profile_by_id', {
            p_profile_id: userId
          });

        if (error) throw error;
        setProfile(data);
      } catch (err) {
        console.error('Error loading profile:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [userId]);

  if (!userId) return <span className="text-gray-600">Unassigned</span>;
  if (loading) return <span className="text-gray-600">Loading...</span>;
  if (error) return <span className="text-red-600">Error loading user</span>;
  if (!profile) return <span className="text-gray-600">Unknown user</span>;

  return (
    <span className="text-gray-600">
      {profile.name || profile.email || 'Unnamed user'}
    </span>
  );
}

AssignedUserDisplay.propTypes = {
  userId: PropTypes.string
}; 