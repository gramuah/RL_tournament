import unittest
from tournament.configure_repository import protection_payload, REQUIRED_CHECKS


class SettingsTests(unittest.TestCase):
    def test_initial_protects_admins_without_requiring_absent_checks(self):
        result = protection_payload(None, 'initial')
        self.assertTrue(result['enforce_admins'])
        self.assertIsNone(result['required_status_checks'])
        self.assertFalse(result['required_pull_request_reviews']['require_code_owner_reviews'])
        self.assertEqual(result['required_pull_request_reviews']['required_approving_review_count'], 1)

    def test_postmerge_upgrades_initial_and_is_idempotent(self):
        first = protection_payload(None, 'initial')
        upgraded = protection_payload(first, 'post-merge')
        self.assertTrue(upgraded['required_pull_request_reviews']['require_code_owner_reviews'])
        self.assertEqual({entry['context'] for entry in upgraded['required_status_checks']['checks']}, set(REQUIRED_CHECKS))
        self.assertEqual(protection_payload(upgraded, 'post-merge'), upgraded)

    def test_preserves_stronger_reviews_checks_and_other_supported_requirements(self):
        existing = {'required_pull_request_reviews': {'required_approving_review_count': 2, 'require_last_push_approval': True}, 'required_status_checks': {'strict': True, 'checks': [{'context': 'Existing test', 'app_id': 9}]}, 'required_linear_history': {'enabled': True}, 'lock_branch': {'enabled': True}}
        result = protection_payload(existing, 'post-merge')
        self.assertEqual(result['required_pull_request_reviews']['required_approving_review_count'], 2)
        self.assertTrue(result['required_pull_request_reviews']['require_last_push_approval'])
        self.assertTrue(result['required_linear_history'])
        self.assertTrue(result['lock_branch'])
        self.assertIn({'context': 'Existing test', 'app_id': 9}, result['required_status_checks']['checks'])

    def test_unknown_setting_or_conflicting_app_requires_review(self):
        with self.assertRaises(ValueError):
            protection_payload({'unexpected_policy': True}, 'post-merge')
        with self.assertRaises(ValueError):
            protection_payload({'required_status_checks': {'checks': [{'context': REQUIRED_CHECKS[0], 'app_id': 42}]}}, 'post-merge')


class PagesEnvironmentTests(unittest.TestCase):
    def setUp(self):
        self.policies = [{'id': 1, 'name': 'main', 'type': 'branch'}, {'id': 2, 'name': 'gh-pages', 'type': 'branch'}]
        self.writes = []
        self.mode = {'protected_branches': False, 'custom_branch_policies': True}

    def api(self, path, method='GET', payload=None, optional=False):
        from tournament.configure_repository import PAGES_ENVIRONMENT
        if path == PAGES_ENVIRONMENT:
            return {'deployment_branch_policy': self.mode, 'protection_rules': [{'type': 'required_reviewers'}]}
        if method == 'POST':
            self.writes.append((path, method, payload))
            item = {'id': 99, **payload}
            self.policies.append(item)
            return item
        if method == 'DELETE':
            self.writes.append((path, method, payload))
            deleted = int(path.rsplit('/', 1)[1])
            self.policies = [item for item in self.policies if item['id'] != deleted]
            return None
        return {'total_count': len(self.policies), 'branch_policies': list(self.policies)}

    def test_remove_legacy_policy_preserve_environment_rules_and_rerun_safely(self):
        from unittest.mock import patch
        from tournament import configure_repository as settings
        with patch.object(settings, 'call', side_effect=self.api):
            settings.restrict_pages_environment()
            self.assertEqual(self.policies, [{'id': 1, 'name': 'main', 'type': 'branch'}])
            self.assertEqual(len(self.writes), 1)
            settings.restrict_pages_environment()
            self.assertEqual(len(self.writes), 1)
            self.assertTrue(all(method != 'PUT' for _, method, _ in self.writes))

    def test_create_main_branch_before_removing_other_branches_and_tags(self):
        from unittest.mock import patch
        from tournament import configure_repository as settings
        self.policies = [{'id': 2, 'name': 'gh-pages', 'type': 'branch'}, {'id': 3, 'name': 'main', 'type': 'tag'}]
        with patch.object(settings, 'call', side_effect=self.api):
            settings.restrict_pages_environment()
        self.assertEqual(self.policies, [{'id': 99, 'name': 'main', 'type': 'branch'}])
        self.assertEqual(self.writes[0][1], 'POST')

    def test_unknown_environment_mode_requires_review_without_mutation(self):
        from unittest.mock import patch
        from tournament import configure_repository as settings
        self.mode = {'protected_branches': True, 'custom_branch_policies': False}
        with patch.object(settings, 'call', side_effect=self.api), self.assertRaises(ValueError):
            settings.restrict_pages_environment()
        self.assertEqual(self.writes, [])


if __name__ == '__main__':
    unittest.main()
