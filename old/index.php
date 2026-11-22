<?php
//error_reporting(E_ALL);
//ini_set("display_errors", 1);
foreach ($_GET AS $field => $value){
$$field = $value;
}

$sql_STRING = getenv("QUERY_STRING");
$SCRIPT_NAME = getenv("SCRIPT_NAME");
?>

<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN">
<html>
<head><meta http-equiv="Content-Type" content="text/html; charset=utf-8">
    
<title>Blodslitets slitere</title>
<link rel=stylesheet href="style.css">
<link rel="stylesheet" href="bubble-tooltip.css" media="screen">
<script type="text/javascript" src="bubble-tooltip.js"></script>

</head>

<body>

  <h1>Blodslitets slitere</h1>
  <p><img src="fullforte_tekst.gif"></p>

  <form method="GET" action=".">
  <table border=0 width="100%" cellpadding=5>
  <tr><td bgcolor="#cccccc">
  Søk etter navn eller klubb : <input name="s" value="<?php echo $s; ?>"> <input type="submit" value="Søk">
  </td>
  </tr>
  </table>
  </form>

				<p><table border=0 width="100%" cellspacing=0 cellpadding=4>
					<tr><td></td><td></td><td align=left nowrap class=maalelinje><table border=0 cellspacing=0 cellpadding=0><tr><td width=15><font size=1>&nbsp;</font></td><td width=60><font size=1 color="#999999">1970</font></td><td width=60><font size=1 color="#999999">1980</font></td><td width=60><font size=1 color="#999999">1990</font></td><td width=60><font size=1 color="#999999">2000</font></td><td width=60><font size=1 color="#999999">2010</font></td></tr></table></td></tr>
         
          
<?php
// Connecting, selecting database
$conn = new mysqli('localhost', '', '', '');
// check connection
if ($conn->connect_error) {
  trigger_error('Database connection failed: '  . $conn->connect_error, E_USER_ERROR);
}

mysqli_query($conn, "SET NAMES 'utf8' COLLATE 'utf8_general_ci'");


//mysqli_select_db('fsk_fullfort') or die('Could not select database');


if ($s != "") {
  if (strlen($s) < 3) {
    echo "</table><p>Søkeordet er for kort.</p>";
  }
  else {
    $sql = "SELECT * FROM fullfort WHERE (";
    
    $keywords = explode(" ", strtolower_utf8($s));
    
    foreach ($keywords as $key => $keyword) {
      if ($key > 0) {
        $sql = $sql . " AND ";
      }
      $sql = $sql . "((FIRSTNAME Like '%" . $keyword . "%') Or (SURNAME Like '%" . $keyword . "%') Or (CLUB Like '%" . $keyword . "%'))";
    }

    
    $sql = $sql . ") ORDER BY fullfort.COUNT DESC , fullfort.SURNAME, fullfort.FIRSTNAME";

    //$result = mysqli_query($sql) or die('Query failed: ' . mysqli_error());
    $result=$conn->query($sql);
 
    if($result === false) {
      trigger_error('Wrong SQL: ' . $sql . ' Error: ' . $conn->error, E_USER_ERROR  );
    } else {
      //$rows_returned = $result->num_rows;
      $arr = $result->fetch_all(MYSQLI_ASSOC);
    }
  
    $sokres = 0;
    
    foreach($arr as $rs) {
      $sokres ++;
      $kolonnenr = 0;
      echo "\t<tr>\n";
      
      foreach ($rs as $col_value) {
        $kolonnenr ++;
        if ($kolonnenr == 1) {
          echo "\n";
        }
        elseif ($kolonnenr == 3) {
          echo "\t\t<td>$col_value</td>\n";
        }
        elseif ($kolonnenr == 4) {
          echo "\t\t<td>".UpperCase($col_value)." ";
        }
        elseif ($kolonnenr == 5) {
          echo UpperCase($col_value).", ";
        }
        elseif ($kolonnenr == 6) {
          echo UpperCase($col_value)."</td>\n";
        }
        elseif ($kolonnenr > 6) {
          if ($kolonnenr == 7) {
            echo "\t\t<td>";
          }
          if (trim($col_value) == "") {
            echo "<img src=gjennomsiktig.gif height=11 width=6>";
          }
          else {
            echo "<img src=red.gif height=11 width=6 onmouseover=\"showToolTip(event,'" . ($kolonnenr+1961) . ": " . $col_value . "');return false\" onmouseout=\"hideToolTip()\">";
          }
        }
      }
      echo "\t\t</td>\n\t</tr>\n";
    }
    echo "</table>\n";    
    echo "<p>Fant " . $sokres . " løpere.</p>\n\n";
        
  }
}
else {
  $sql = "SELECT * FROM fullfort ORDER BY count DESC, SURNAME, FIRSTNAME";
 
  $result=$conn->query($sql);
 
  if($result === false) {
    trigger_error('Wrong SQL: ' . $sql . ' Error: ' . $conn->error, E_USER_ERROR);
  } else {
    //$rows_returned = $result->num_rows;
    $arr = $result->fetch_all(MYSQLI_ASSOC);
  }



  $i = 101;

  $fullfort = $f;

  foreach($arr as $rs) {
    if ($fullfort == "") {
      $fullfort = $rs["COUNT"];
    }
    if (($i < 101) || ($rs["COUNT"] == $count_last)) {
      $i++;
    }
    else {
      $i=1;
      
      //lage selector-link for forrige gruppe
      if ($count_start != "") {
        if ($count_start != $fullfort) {
          $selector = $selector . "<a href=./?f=" . $count_start . ">";
        }
        $selector = $selector . $count_start;
        if ($count_start != $count_last) {
          $selector = $selector . "&nbsp;-&nbsp;" . $count_last;
        }
        $selector = $selector . "&nbsp;fullførte";
        if ($count_start != $fullfort) {
          $selector = $selector . "</a>";
        }
        $selector = $selector . "&nbsp;| ";
      }

      if ($fullfort == $rs["COUNT"]) {
        $printThis = 1;
      }
      else {
        $printThis = 0;
      }

      $count_start = $rs["COUNT"];

    }  


  
    if ($printThis == 1) {
      $kolonnenr = 0;
      echo "\t<tr>\n";
      foreach ($rs as $col_value) {
        $kolonnenr ++;
        if ($kolonnenr == 1) {
          echo "\n";
        }
        elseif ($kolonnenr == 3) {
          echo "\t\t<td>$col_value</td>\n";
        }
        elseif ($kolonnenr == 4) {
          echo "\t\t<td>$col_value ";
//          echo "\t\t<td>".UpperCase($col_value)." ";
        }
        elseif ($kolonnenr == 5) {
          echo $col_value.", ";
//          echo UpperCase($col_value).", ";
        }
        elseif ($kolonnenr == 6) {
          echo $col_value."</td>\n";
//          echo UpperCase($col_value)."</td>\n";
        }
        elseif ($kolonnenr > 6) {
          if ($kolonnenr == 7) {
            echo "\t\t<td>";
          }
          if (trim($col_value) == "") {
            echo "<img src=gjennomsiktig.gif height=11 width=6>";
          }
          else {
            echo "<img src=red.gif height=11 width=6 onmouseover=\"showToolTip(event,'" . ($kolonnenr+1961) . ": " . $col_value . "');return false\" onmouseout=\"hideToolTip()\">";
          }
        }
      }
      echo "\t\t</td>\n\t</tr>\n";
    }
    $count_last = $rs["COUNT"];
  }



  
  // lage selector-objekt for siste gruppe
  if ($count_start != $fullfort) {
    $selector = $selector . "<a href=./?f=" . $count_start . ">";
  }
  $selector = $selector . $count_start;
  if ($count_start != $count_last) {
    $selector = $selector . " - " . $count_last;
  }
  $selector = $selector . " fullførte";
  if ($count_start != $fullfort) {
    $selector = $selector . "</a>";
  }
  
  echo "</table>";
  echo "<p>" . $selector . "</p>";












  
}






// Free resultset
//mysqli_stmt_free_result($result);

// Closing connection
//mysqli_close($link);
?>

<div id="bubble_tooltip">
	<div class="bubble_top"><span></span></div>
	<div class="bubble_middle"><span id="bubble_tooltip_content">Bubble</span></div>
	<div class="bubble_bottom"></div>
</div>

</body>
</html>

<?php
function UpperCase($arg)
{
	$a_result = explode(" ",strtolower_utf8($arg));
  
  foreach ($a_result as $i => $a_result_i) {
		if (strlen($a_result_i) < 3) {
      if ($a_result_i == "og") {
        $retval = $retval . " " . strtolower_utf8($a_result_i);
      }
      else {
        $retval = $retval . " " . strtoupper_utf8($a_result_i);
      }
    }
		else {
      if (($a_result_i == "spk") or ($a_result_i == "ntnui") or ($a_result_i == "fso") or ($a_result_i == "ssk") or ($a_result_i == "hfs"))  {
        $retval = $retval . " " . strtoupper_utf8($a_result_i);
      }
      else {
        $retval = $retval . " " . strtoupper_utf8(substr($a_result_i,0,1)) . substr($a_result_i,1);
      }
		}
  }
  return $retval;
}

function strtolower_utf8($string){ 
  $convert_to = array( 
    "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", 
    "v", "w", "x", "y", "z", "à", "á", "â", "ã", "ä", "å", "æ", "ç", "è", "é", "ê", "ë", "ì", "í", "î", "ï", 
    "ð", "ñ", "ò", "ó", "ô", "õ", "ö", "ø", "ù", "ú", "û", "ü", "ý", "?", "?", "?", "?", "?", "?", "?", "?", 
    "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", 
    "?", "?", "?", "?" 
  ); 
  $convert_from = array( 
    "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", 
    "V", "W", "X", "Y", "Z", "À", "Á", "Â", "Ã", "Ä", "Å", "Æ", "Ç", "È", "É", "Ê", "Ë", "Ì", "Í", "Î", "Ï", 
    "Ð", "Ñ", "Ò", "Ó", "Ô", "Õ", "Ö", "Ø", "Ù", "Ú", "Û", "Ü", "Ý", "?", "?", "?", "?", "?", "?", "?", "?", 
    "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", 
    "?", "?", "?", "?" 
  ); 

  return str_replace($convert_from, $convert_to, $string); 
} 


function strtoupper_utf8($string){ 
  $convert_from = array( 
    "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", 
    "v", "w", "x", "y", "z", "à", "á", "â", "ã", "ä", "å", "æ", "ç", "è", "é", "ê", "ë", "ì", "í", "î", "ï", 
    "ð", "ñ", "ò", "ó", "ô", "õ", "ö", "ø", "ù", "ú", "û", "ü", "ý", "?", "?", "?", "?", "?", "?", "?", "?", 
    "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", 
    "?", "?", "?", "?" 
  ); 
  $convert_to = array( 
    "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", 
    "V", "W", "X", "Y", "Z", "À", "Á", "Â", "Ã", "Ä", "Å", "Æ", "Ç", "È", "É", "Ê", "Ë", "Ì", "Í", "Î", "Ï", 
    "Ð", "Ñ", "Ò", "Ó", "Ô", "Õ", "Ö", "Ø", "Ù", "Ú", "Û", "Ü", "Ý", "?", "?", "?", "?", "?", "?", "?", "?", 
    "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", 
    "?", "?", "?", "?" 
  ); 

  return str_replace($convert_from, $convert_to, $string); 
} 
?>
