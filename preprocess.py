import argparse
import json
import pandas as pd

from helpers import *


def main():

    parser = argparse.ArgumentParser()
    parser.add_argument(
        "-ld",
        "--libdata",
        default="data/PLS_FY22_AE_pud22i.csv",
        help="Path to library data .csv file",
    )
    parser.add_argument(
        "-out",
        "--outputfile",
        default="public/data/2022-library-data.json",
        help="Path to ethnicity data .csv file",
    )
    parser.add_argument("-d", "--debug", action="store_true", help="Debug mode")
    args = parser.parse_args()

    # Read zipcode data to retrieve county codes
    zip_df = pd.read_csv("data/us_zip_fips_county.csv", encoding="latin-1")
    zip_df = zip_df[["Zip Code", "FIPS Code"]]

    # Read the library data
    lib_df = pd.read_csv(args.libdata, encoding="latin-1")
    print(f"Found {lib_df.shape[0]:,} entries in {args.libdata}")

    # Read the Census data
    census_county_df = get_census_data(by="County")
    census_zip_df = get_census_data(by="Zipcode")

    # Merge lib data with zipcode data to get count IDs
    lib_df["ZIP"] = lib_df.apply(
        lambda row: str(parse_int(row["ZIP"], 0)).zfill(5), axis=1
    )
    zip_df["ZIP"] = zip_df.apply(
        lambda row: str(parse_int(row["Zip Code"], 0)).zfill(5), axis=1
    )
    lib_df = pd.merge(lib_df, zip_df, on="ZIP", how="left")

    # Merge all the data
    lib_df = merge_data(
        lib_df,
        census_county_df,
        census_zip_df,
    )
    print(f"Found {lib_df.shape[0]:,} entries after merging")

    # Add link to URL
    lib_df["GEO_URL"] = lib_df.apply(
        lambda row: f"https://www.openstreetmap.org/?mlat={row['LATITUDE']}&mlon={row['LONGITUD']}&zoom=12",
        axis=1,
    )

    # Calculate per capita values
    print("Calculating percentages...")
    lib_df = calculate_per(lib_df, "VISITS", "POPU_LSA", "VISITS_PER")
    lib_df = calculate_rank(lib_df, "VISITS_PER", "VISITS_PER_N")
    lib_df = calculate_per(lib_df, "TOTPRO", "POPU_LSA", "PRO_PER")
    lib_df = calculate_rank(lib_df, "PRO_PER", "PRO_PER_N")
    lib_df = calculate_per(lib_df, "TOTATTEN", "TOTPRO", "ATTEN_PER")
    lib_df = calculate_rank(lib_df, "ATTEN_PER", "ATTEN_PER_N")
    lib_df = calculate_per(lib_df, "PITUSR", "POPU_LSA", "COMP_PER")
    lib_df = calculate_rank(lib_df, "COMP_PER", "COMP_PER_N")
    lib_df = calculate_per(lib_df, "WIFISESS", "POPU_LSA", "WIFI_PER")
    lib_df = calculate_rank(lib_df, "WIFI_PER", "WIFI_PER_N")
    lib_df = calculate_per(lib_df, "TOTINCM", "POPU_LSA", "INCM_PER")
    lib_df = calculate_per(lib_df, "TOTSTAFF", "POPU_LSA", "STAFF_PER", 3, 1000)

    # # Parse census tract description
    # income_df["CENSUS_TRACT_DESCRIPTION"] = income_df.apply(
    #     lambda row: "{0} ({1}, {2})".format(*str(row["NAME"]).split("; ")), axis=1
    # )

    # Parse income
    lib_df["MEDIAN_INCOME"] = lib_df.apply(
        lambda row: parse_int(row["B19013_001E"]), axis=1
    )

    # Take only the data that we need, and rename them
    print("Outputing results...")
    columns = {
        "LIBID": "id",
        "LIBNAME": "name",
        "ADDRESS": "address",
        "CITY": "city",
        "STABR": "state",
        "C_RELATN": "relationship",
        "GEOCODE": "geographic",
        "POPU_LSA": "pop_lsa",
        "BRANLIB": "branches",
        "LIBRARIA": "librarians",
        "TOTSTAFF": "staff",
        "TOTINCM": "op_revenue",
        "CAP_REV": "cap_revenue",
        "TOTPHYS": "tot_phys_items",
        "ELECCOLL": "tot_e_items",
        "VISITS": "visits",
        "TOTPRO": "programs",
        "ONPRO": "onsite_programs",
        "VIRPRO": "virtual_programs",
        "TOTATTEN": "program_attendance",
        "ONATTEN": "onsite_program_attendance",
        "VIRATTEN": "virtual_program_attendance",
        "PITUSR": "computer_sessions",
        "WIFISESS": "wireless_sessions",
        "OBEREG": "region",
        "LONGITUD": "lon",
        "LATITUDE": "lat",
        "LOCALE_ADD": "locale_type",
        "CDCODE": "district",
        "MEDIAN_INCOME": "income",
        "GEO_URL": "geo_url",
        "VISITS_PER": "visits_per_capita",
        "PRO_PER": "programs_per_capita",
        "ATTEN_PER": "attendance_per_program",
        "COMP_PER": "computer_per_capita",
        "WIFI_PER": "wifi_per_capita",
        "INCM_PER": "op_revenue_per_capita",
        "STAFF_PER": "staff_per_capita",
        "VISITS_PER_N": "visits_per_capita_norm",
        "PRO_PER_N": "programs_per_capita_norm",
        "ATTEN_PER_N": "attendance_per_program_norm",
        "COMP_PER_N": "computer_per_capita_norm",
        "WIFI_PER_N": "wifi_per_capita_norm",
    }
    old_columns = list(columns.keys())
    new_columns = list(columns.values())
    lib_df = lib_df.filter(old_columns, axis=1)
    lib_df = lib_df.rename(columns=columns)

    # Fill NaN
    lib_df = lib_df.fillna(-1)

    # Convert to rows
    records = lib_df.to_dict("records")
    rows = []
    for record in records:
        row = []
        for col in new_columns:
            if col in record:
                row.append(record[col])
            else:
                row.append("")
        rows.append(row)

    json_out = {"cols": new_columns, "rows": rows}
    with open(args.outputfile, "w") as f:
        json.dump(json_out, f)
    print(f"Created data file at {args.outputfile}. Done.")


main()
