import unittest
from .studio_converter import StudioSpecConverter
from .url_builder import LinkingUrlBuilder
from .renderer import StudioRenderer
from .spec_models import DashboardSpec


class IntegrationTestLookerStudio(unittest.TestCase):
    def setUp(self):
        self.converter = StudioSpecConverter()
        self.builder = LinkingUrlBuilder(StudioRenderer())

        # Mock markdown content for 6 functional boards
        self.md_content = """
## 1. Executive & Prediction
| 01 | Revenue | `fact_orders` | - | revenue | KPI | |
| 02 | Top Brands | `fact_details` | brand | revenue | Bar | |

## 2. Channel & Operations
| 07 | Channel Profit | `fact_orders` | channel | profit | Column | |
"""

    def test_generate_6_board_urls(self):
        specs = self.converter.parse_markdown(self.md_content)

        # Group specs by dashboard (simulated by description/section)
        boards = {}
        for spec in specs:
            section = spec.description
            if section not in boards:
                boards[section] = []
            boards[section].append(spec)

        generated_urls = {}
        for section, chart_specs in boards.items():
            dash = DashboardSpec(
                dashboard_id=section.lower().replace(" ", "_"), title=section, charts=chart_specs
            )
            # Pass a mock template ID to satisfy KB requirement
            url = self.builder.build_dashboard_url(dash, template_id="mock-template-id")
            generated_urls[section] = url

            print(f"\n[Generated URL for {section}]:\n{url[:100]}...")  # Print preview

            # Assertions
            self.assertIn("lookerstudio.google.com", url)
            self.assertIn("ds.*.projectId=b25h01-ragic", url)

            # URL encode replaces space with '+' but '&' becomes '%26'
            expected_name = section.replace(" ", "+").replace("&", "%26")
            self.assertIn(f"r.reportName={expected_name}", url)

            self.assertIn("c.mode=view", url)
            self.assertIn("c.reportId=mock-template-id", url)

        self.assertEqual(len(generated_urls), 2)  # We mocked 2 sections


if __name__ == "__main__":
    unittest.main()
