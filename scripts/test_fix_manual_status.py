import sys
import os
from unittest.mock import MagicMock, patch

# Add project root to path
sys.path.append(os.getcwd())

from app.cleaning.result_writer import ResultWriter

def test_fix_inconsistent_manual_status():
    print("Testing fix_inconsistent_manual_status...")

    # Mock BigQueryClient
    mock_bq_client = MagicMock()
    
    # Mock return value of query()
    mock_job = MagicMock()
    mock_job.num_dml_affected_rows = 5
    mock_bq_client.query.return_value = mock_job
    
    # Mock getting table Ids
    mock_bq_client.get_table_id.side_effect = lambda x: f"project.dataset.{x}"

    # Create ResultWriter with mock client
    writer = ResultWriter(bq_client=mock_bq_client)

    # Patch symbol_config inside result_writer
    with patch("app.cleaning.result_writer.get_symbol_config") as mock_get_config:
        # Mock config.get_sheet_table to return "table_X"
        mock_config = MagicMock()
        mock_config.get_sheet_table.side_effect = lambda x: f"sheet_{x}"
        mock_get_config.return_value = mock_config

        # Run the function
        # Test 1: Fix specific table
        print("\nTest 1: Fix specific table code '50'")
        results = writer.fix_inconsistent_manual_status(table_code="50")
        
        print(f"Results: {results}")

        # Verify calls
        assert results == {"50": 5}
        
        # Verify query arguments
        # We expect one query call
        args, kwargs = mock_bq_client.query.call_args
        sql, params = args[0], args[1]
        
        print(f"SQL Executed:\n{sql}")
        print(f"Params: {params}")

        # Basic assertions on SQL
        assert "UPDATE `project.dataset.sheet_50`" in sql
        assert "cleaning_status = 'completed'" in sql
        assert "cleaning_status = 'manual'" in sql
        assert "params['table_code'] == '50'"
        
        # Test 2: Fix default tables (no arg)
        print("\nTest 2: Fix all default tables")
        mock_bq_client.query.reset_mock()
        
        # Simulate different affected rows for different calls
        # We expect calls for 10, 20, 30... 99 (10 tables)
        # Let's just say 1 affected row for each for simplicity in this mock setup
        mock_job.num_dml_affected_rows = 1
        
        results_all = writer.fix_inconsistent_manual_status()
        print(f"Results: {results_all}")
        
        assert len(results_all) == 10
        assert mock_bq_client.query.call_count == 10

    print("\n✅ All tests passed!")

if __name__ == "__main__":
    test_fix_inconsistent_manual_status()
