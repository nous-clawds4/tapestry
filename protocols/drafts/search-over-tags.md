Search Over Tags
=====

# Overview

Traditional keyword search looks for matches between the search string and the content (profiles, articles, product listings, etc) being searched. Search Over Tags matches the search string to Tags (name, description, etc) that are applied to the content. Either of these two methods can be used individually or in conjunction with one another.

# Advantages

Search Over Tags carries several advantages over traditional content string matching:
- Tags are applied externally, not necessarily by the content author
- Typically, the volume of Tags is less than the volume of content, thus making the sting-matching step more performant and/or able to cover a larger search space
- ability to support complex multi-hop graph db queries based on curated relationships among Tags and between Tags and other data, something not possible with traditional search

# Disadvantages
- Tags may not be exhaustive and so may miss potential matches

This disadvantage can be addressed simply by applying both search strategies simultaneously in parallel and then combining the results. 
