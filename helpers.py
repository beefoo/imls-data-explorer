import itertools
from operator import itemgetter
import pandas as pd
from tqdm import tqdm


def calculate_per(df, value_key, total_key, new_key, precision=3, multiplier=1):
    curve = 1.0
    df[new_key] = df.apply(
        lambda row: (
            round(pow(row[value_key] / row[total_key], curve) * multiplier, precision)
            if row[total_key] > 0 and row[value_key] > 0
            else 0
        ),
        axis=1,
    )
    return df


def calculate_rank(df, value_key, new_key, descending=False):
    precision = 10000
    df[value_key].fillna(value=-1, inplace=True)
    values = df[value_key].tolist()
    values = [int(round(v * precision)) for v in values]
    values.sort(reverse=descending)
    df[new_key] = df.apply(
        lambda row: (values.index(int(round(row[value_key] * precision))) + 1),
        axis=1,
    )
    return df


def find_where(df, key, value):
    results = df.query(f'{key} == "{value}"')
    print(results.shape[0])
    if results.shape[0] > 0:
        return results.iloc[0]
    return None


def get_census_data(path="data/", by="County"):
    income_df = pd.read_csv(
        f"{path}ACSDT5Y2023.B19013-Data-Household-Income-By-{by}.csv", skiprows=[1]
    )
    print(
        f"Found {income_df.shape[0]:,} entries from the Census median household income dataset by {by}"
    )
    return income_df


def get_census_value(row, field, census_county, census_zip):
    value = -1
    # If a city, use county data
    if (
        row["LOCALE_ADD"] < 20
        and row["LOCALE_ADD"] > 0
        and row["GEO_ID_COUNTY"] in census_county
    ):
        value = census_county[row["GEO_ID_COUNTY"]][field]

    # Otherwise, use zipcode data
    elif row["GEO_ID_ZIPCODE"] in census_zip:
        value = census_zip[row["GEO_ID_ZIPCODE"]][field]

    return value


def group_list(arr, groupBy, sort=False, desc=True):
    """Group a list by value"""
    groups = []
    arr = sorted(arr, key=itemgetter(*groupBy))
    for key, items in itertools.groupby(arr, key=itemgetter(*groupBy)):
        group = {}
        litems = list(items)
        count = len(litems)
        group["groupKey"] = tuple(groupBy)
        group["items"] = litems
        group["count"] = count
        groups.append(group)
    if sort:
        isReversed = desc
        groups = sorted(groups, key=lambda k: k["count"], reverse=isReversed)
    return groups


def merge_data(
    lib_df,
    census_county_df,
    census_zip_df,
):
    # Add Geo ID's to use to merge with Census data
    lib_df["GEO_ID_COUNTY"] = lib_df.apply(
        lambda row: f"0500000US{str(parse_int(row['FIPS Code'], 0)).zfill(5)}", axis=1
    )
    lib_df["GEO_ID_ZIPCODE"] = lib_df.apply(
        lambda row: f"860Z200US{str(parse_int(row['ZIP'], 0)).zfill(5)}", axis=1
    )

    # Create lookup tables on GEO_ID
    census_county = dict(
        [(row["GEO_ID"], row) for row in census_county_df.to_records()]
    )
    census_zip = dict([(row["GEO_ID"], row) for row in census_zip_df.to_records()])

    # Next, add Census data to lib_df
    census_fields = [
        "B19013_001E",  # Median houshold income
    ]
    for field in census_fields:
        lib_df[field] = lib_df.apply(
            lambda row: get_census_value(row, field, census_county, census_zip),
            axis=1,
        )
        lib_df[field].fillna(-1, inplace=True)

    return lib_df


def parse_int(value, default_value=-1):
    parsed_value = default_value
    try:
        svalue = str(value).replace(",", "").replace("+", "")
        if "." in svalue:
            svalue = svalue.split(".")[0]
        parsed_value = int(svalue)
    except:
        parsed_value = default_value
    return parsed_value


def round_int(value):
    return int(round(value))
